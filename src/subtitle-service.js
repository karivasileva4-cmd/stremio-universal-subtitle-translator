const { createHash } = require("node:crypto");
const { TextDecoder, promisify } = require("node:util");
const { execFile } = require("node:child_process");

const {
  base64UrlDecode,
  base64UrlEncode,
  manifestUrlToBaseUrl
} = require("./config");
const {
  discoverEmbeddedSubtitleCandidates,
  extractEmbeddedSubtitleText
} = require("./embedded-subtitles");
const {
  applyTranslatedCueTexts,
  extractCueTexts,
  parseSubtitleDocument,
  renderBlocksAsVtt
} = require("./subtitle-file");

const execFileAsync = promisify(execFile);
const EDGE_TRANSLATE_BASE_URL = "https://edge.microsoft.com/translate/translatetext";
const LOCAL_STREMIO_SUBTITLE_PROXY = "http://127.0.0.1:11470/subtitles.vtt?from=";
const TRANSLATION_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

function parseExtraArgs(segment) {
  if (!segment) {
    return {};
  }

  return Object.fromEntries(new URLSearchParams(segment).entries());
}

function buildSubtitleResourceUrl(manifestUrl, type, id, extra = {}) {
  const baseUrl = manifestUrlToBaseUrl(manifestUrl);
  const extraString = new URLSearchParams(
    Object.entries(extra).filter(([, value]) => value != null && value !== "")
  ).toString();

  return `${baseUrl}/subtitles/${encodeURIComponent(type)}/${encodeURIComponent(id)}${
    extraString ? `/${extraString}` : ""
  }.json`;
}

function isEnglishLanguageLabel(label, config) {
  const normalized = String(label || "")
    .trim()
    .toLowerCase();

  if (!normalized) {
    return false;
  }

  return config.sourceLanguageCodes.some((code) => {
    const candidate = String(code || "").trim().toLowerCase();

    return (
      normalized === candidate ||
      normalized.startsWith(`${candidate}-`) ||
      normalized.includes(` ${candidate} `) ||
      normalized.includes(`(${candidate})`)
    );
  });
}

function isEnglishSubtitle(subtitle, config) {
  return isEnglishLanguageLabel(subtitle.lang, config) || isEnglishLanguageLabel(subtitle.language, config);
}

function summarizeSourceName(manifestUrl) {
  try {
    return new URL(manifestUrl).hostname.replace(/^www\./i, "");
  } catch (error) {
    return "source";
  }
}

function sanitizeVariantLabel(label) {
  return String(label || "")
    .replace(/\s+/g, " ")
    .replace(/\.(srt|vtt|ass|ssa)$/i, "")
    .trim();
}

function buildVariantLabel(candidate) {
  if (candidate.kind === "embedded") {
    const rawVariant =
      sanitizeVariantLabel(candidate.title) ||
      sanitizeVariantLabel(candidate.language) ||
      sanitizeVariantLabel(candidate.subtitle.label) ||
      `Track ${candidate.streamIndex}`;

    return `Embedded - ${rawVariant}`.slice(0, 96);
  }

  const sourceName = summarizeSourceName(candidate.sourceManifestUrl);
  const subtitle = candidate.subtitle;
  const rawVariant =
    sanitizeVariantLabel(subtitle.id) ||
    sanitizeVariantLabel(subtitle.label) ||
    sanitizeVariantLabel(subtitle.url ? new URL(subtitle.url).pathname.split("/").pop() : "") ||
    "English subtitle";

  return `${sourceName} - ${rawVariant}`.slice(0, 96);
}

function encodeSubtitlePayload(payload) {
  return base64UrlEncode(JSON.stringify(payload));
}

function decodeSubtitlePayload(encoded) {
  return JSON.parse(base64UrlDecode(encoded));
}

async function fetchJson(url, fetchImpl) {
  const response = await fetchImpl(url, {
    headers: {
      accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }

  return response.json();
}

async function fetchEnglishSubtitleCandidates({ config, type, id, extra, fetchImpl = fetch }) {
  const sourceManifestUrls = config.sourceManifestUrls || [];

  const batches = await Promise.allSettled(
    sourceManifestUrls.map(async (manifestUrl) => {
      const resourceUrl = buildSubtitleResourceUrl(manifestUrl, type, id, extra);
      const payload = await fetchJson(resourceUrl, fetchImpl);
      const subtitles = Array.isArray(payload.subtitles) ? payload.subtitles : [];

      return subtitles
        .filter((subtitle) => subtitle && subtitle.url && isEnglishSubtitle(subtitle, config))
        .map((subtitle) => ({
          kind: "external",
          sourceManifestUrl: manifestUrl,
          subtitle
        }));
    })
  );

  const seenUrls = new Set();
  const candidates = [];

  for (const batch of batches) {
    if (batch.status !== "fulfilled") {
      continue;
    }

    for (const candidate of batch.value) {
      const key = candidate.subtitle.url;

      if (seenUrls.has(key)) {
        continue;
      }

      seenUrls.add(key);
      candidates.push(candidate);
    }
  }

  return candidates;
}

async function fetchEmbeddedSubtitleCandidates({
  config,
  extra,
  fetchImpl = fetch,
  execFileImpl = execFileAsync
}) {
  const candidates = await discoverEmbeddedSubtitleCandidates({
    config,
    requestInfo: {
      filename: extra && extra.filename,
      videoSize: extra && extra.videoSize
    },
    fetchImpl,
    execFileImpl
  });

  const seen = new Set();
  const uniqueCandidates = [];

  for (const candidate of candidates) {
    const key = `${candidate.mediaUrl}::${candidate.streamIndex}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    uniqueCandidates.push(candidate);
  }

  return uniqueCandidates;
}

function buildTranslatedSubtitleEntries({ candidates, config, configSegment, originBaseUrl }) {
  return candidates.map((candidate, index) => {
    const variantLabel = buildVariantLabel(candidate);
    const payload = encodeSubtitlePayload({
      kind: candidate.kind || "external",
      sourceUrl: candidate.subtitle.url || null,
      sourceManifestUrl: candidate.sourceManifestUrl,
      variantLabel,
      ordinal: index,
      mediaUrl: candidate.mediaUrl || null,
      streamIndex: candidate.streamIndex || null,
      title: candidate.title || null,
      language: candidate.language || null
    });

    return {
      id: `Bulgarian - ${variantLabel}`,
      lang: "bul",
      language: "bul",
      title: `Bulgarian - ${variantLabel}`,
      url: new URL(`/${configSegment}/translated/${payload}.vtt`, originBaseUrl).toString()
    };
  });
}
function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function createTranslationCacheKey(config, payload) {
  return sha256(
    JSON.stringify({
      displayLanguage: config.displayLanguage,
      targetLanguageCode: config.targetLanguageCode,
      kind: payload.kind || "external",
      sourceUrl: payload.sourceUrl,
      sourceManifestUrl: payload.sourceManifestUrl,
      mediaUrl: payload.mediaUrl,
      streamIndex: payload.streamIndex
    })
  );
}

function isSafeSubtitleUrl(value) {
  try {
    const parsed = new URL(value);
    return /^https?:$/i.test(parsed.protocol);
  } catch (error) {
    return false;
  }
}

function shouldTryLocalProxy(sourceUrl, config) {
  if (!config.useLocalStremioProxy) {
    return false;
  }

  try {
    const parsed = new URL(sourceUrl);

    if (/^127\.0\.0\.1$|^localhost$/i.test(parsed.hostname) && parsed.pathname === "/subtitles.vtt") {
      return false;
    }
  } catch (error) {
    return false;
  }

  return true;
}

function decodeSubtitleBuffer(buffer, contentType) {
  const charsetMatch = /charset=([^;]+)/i.exec(contentType || "");
  const fallbackCharsets = [];

  if (charsetMatch) {
    fallbackCharsets.push(charsetMatch[1].trim().toLowerCase());
  }

  fallbackCharsets.push("utf-8", "windows-1252", "iso-8859-1");

  for (const charset of fallbackCharsets) {
    try {
      return new TextDecoder(charset).decode(buffer);
    } catch (error) {
      continue;
    }
  }

  return new TextDecoder("utf-8").decode(buffer);
}

async function fetchSubtitleDocumentText(sourceUrl, config, fetchImpl = fetch) {
  if (!isSafeSubtitleUrl(sourceUrl)) {
    throw new Error(`Unsupported subtitle URL: ${sourceUrl}`);
  }

  const attempts = [];

  if (shouldTryLocalProxy(sourceUrl, config)) {
    attempts.push({
      url: `${LOCAL_STREMIO_SUBTITLE_PROXY}${encodeURIComponent(sourceUrl)}`,
      accept: "text/vtt,text/plain;q=0.9,*/*;q=0.8"
    });
  }

  attempts.push({
    url: sourceUrl,
    accept: "text/plain,text/vtt,application/octet-stream;q=0.9,*/*;q=0.8"
  });

  let lastError;

  for (const attempt of attempts) {
    try {
      const response = await fetchImpl(attempt.url, {
        headers: {
          accept: attempt.accept
        }
      });

      if (!response.ok) {
        throw new Error(`Subtitle fetch failed (${response.status})`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return decodeSubtitleBuffer(Buffer.from(arrayBuffer), response.headers.get("content-type"));
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error(`Failed to fetch subtitle document for ${sourceUrl}`);
}

function shouldTranslateCueText(text) {
  return /[A-Za-z]/.test(String(text || ""));
}

function buildEdgeTranslateUrl(config) {
  return `${EDGE_TRANSLATE_BASE_URL}?from=en&to=${encodeURIComponent(
    config.targetLanguageCode
  )}&isEnterpriseClient=false`;
}

async function translateTextsWithEdge(texts, fetchImpl = fetch, config = { targetLanguageCode: "ku" }) {
  if (texts.length === 0) {
    return [];
  }

  const response = await fetchImpl(buildEdgeTranslateUrl(config), {
    method: "POST",
    headers: {
      "content-type": "application/json;charset=UTF-8",
      accept: "application/json",
      origin: "https://edge.microsoft.com",
      referer: "https://edge.microsoft.com/"
    },
    body: JSON.stringify(texts)
  });

  if (!response.ok) {
    throw new Error(`Translation request failed (${response.status})`);
  }

  const payload = await response.json();

  if (!Array.isArray(payload) || payload.length !== texts.length) {
    throw new Error("Unexpected translation payload shape from Microsoft Edge Translator");
  }

  return payload.map((entry, index) => {
    const translated = entry && entry.translations && entry.translations[0] && entry.translations[0].text;
    return typeof translated === "string" ? translated : texts[index];
  });
}

async function translateCueTexts(cueTexts, config, fetchImpl = fetch, translateImpl = translateTextsWithEdge) {
  const translatedTexts = [...cueTexts];
  const indexesToTranslate = [];
  const sourceTexts = [];

  cueTexts.forEach((text, index) => {
    if (shouldTranslateCueText(text)) {
      indexesToTranslate.push(index);
      sourceTexts.push(text);
    }
  });

  for (let index = 0; index < sourceTexts.length; index += config.translatorBatchSize) {
    const batch = sourceTexts.slice(index, index + config.translatorBatchSize);
    const translatedBatch = await translateImpl(batch, fetchImpl, config);

    translatedBatch.forEach((translatedText, batchIndex) => {
      translatedTexts[indexesToTranslate[index + batchIndex]] = translatedText;
    });
  }

  return translatedTexts;
}

async function getTranslatedSubtitleVtt({
  config,
  payload,
  fetchImpl = fetch,
  translateImpl = translateTextsWithEdge,
  cache,
  execFileImpl = execFileAsync
}) {
  const cacheKey = createTranslationCacheKey(config, payload);

  return cache.getOrCreate(
    cacheKey,
    async () => {
      const subtitleText =
        payload.kind === "embedded"
          ? await extractEmbeddedSubtitleText(payload, execFileImpl)
          : await fetchSubtitleDocumentText(payload.sourceUrl, config, fetchImpl);

      const parsedDocument = parseSubtitleDocument(subtitleText);
      const cueTexts = extractCueTexts(parsedDocument);
      const translatedCueTexts = await translateCueTexts(cueTexts, config, fetchImpl, translateImpl);
      const translatedDocument = applyTranslatedCueTexts(parsedDocument, translatedCueTexts);

      return renderBlocksAsVtt(translatedDocument.blocks);
    },
    TRANSLATION_CACHE_TTL_MS
  );
}

module.exports = {
  EDGE_TRANSLATE_BASE_URL,
  LOCAL_STREMIO_SUBTITLE_PROXY,
  buildEdgeTranslateUrl,
  buildSubtitleResourceUrl,
  buildTranslatedSubtitleEntries,
  createTranslationCacheKey,
  decodeSubtitlePayload,
  fetchEmbeddedSubtitleCandidates,
  fetchEnglishSubtitleCandidates,
  fetchSubtitleDocumentText,
  getTranslatedSubtitleVtt,
  isEnglishSubtitle,
  parseExtraArgs,
  translateCueTexts,
  translateTextsWithEdge
};
