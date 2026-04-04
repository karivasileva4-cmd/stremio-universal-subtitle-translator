const { createHash } = require("node:crypto");
const { DEFAULT_STREMIO_ENGINE_URL, normalizeEngineUrl } = require("./embedded-subtitles");

const DEFAULT_TARGET_LANGUAGE_CODE = "ku";
const DEFAULT_DISPLAY_LANGUAGE = "KU";
const DEFAULT_SOURCE_LANGUAGE_CODES = ["eng", "en", "english"];
const DEFAULT_TRANSLATOR_BATCH_SIZE = 25;

function base64UrlEncode(value) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const normalized = String(value)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, "base64").toString("utf8");
}

function splitList(value) {
  if (Array.isArray(value)) {
    return value.flatMap(splitList);
  }

  if (value == null) {
    return [];
  }

  return String(value)
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeManifestUrl(input) {
  const url = new URL(String(input).trim());

  if (!/^https?:$/i.test(url.protocol)) {
    throw new Error(`Only http(s) manifest URLs are supported: ${input}`);
  }

  url.hash = "";
  url.search = "";

  if (!/\/manifest\.json$/i.test(url.pathname)) {
    url.pathname = `${url.pathname.replace(/\/+$/g, "")}/manifest.json`;
  }

  return url.toString();
}

function normalizeSourceManifestUrls(value) {
  const urls = splitList(value);
  return [...new Set(urls.map(normalizeManifestUrl))];
}

function normalizeLanguageCodes(value) {
  const normalized = splitList(value)
    .map((entry) => entry.toLowerCase())
    .filter(Boolean);

  return normalized.length > 0 ? [...new Set(normalized)] : [...DEFAULT_SOURCE_LANGUAGE_CODES];
}

function normalizeTargetLanguageCode(value) {
  const normalized = String(value || DEFAULT_TARGET_LANGUAGE_CODE).trim();
  return normalized || DEFAULT_TARGET_LANGUAGE_CODE;
}

function normalizeDisplayLanguage(value, targetLanguageCode) {
  const normalized = String(value || "").trim();
  return normalized || String(targetLanguageCode || DEFAULT_TARGET_LANGUAGE_CODE).toUpperCase();
}

function toBoolean(value, defaultValue) {
  if (value == null || value === "") {
    return defaultValue;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
}

function toPositiveInteger(value, defaultValue) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

function safeNormalizeEngineUrl(value, defaultValue = DEFAULT_STREMIO_ENGINE_URL) {
  try {
    return normalizeEngineUrl(value || defaultValue);
  } catch (error) {
    return normalizeEngineUrl(defaultValue);
  }
}

function normalizeConfig(raw = {}) {
  const targetLanguageCode = normalizeTargetLanguageCode(raw.targetLanguageCode);

  return {
    sourceManifestUrls: normalizeSourceManifestUrls(
      raw.sourceManifestUrls || raw.sourceManifestUrl || []
    ),
    targetLanguageCode,
    displayLanguage: normalizeDisplayLanguage(
      raw.displayLanguage || DEFAULT_DISPLAY_LANGUAGE,
      targetLanguageCode
    ),
    sourceLanguageCodes: normalizeLanguageCodes(
      raw.sourceLanguageCodes || raw.sourceLanguageCode || DEFAULT_SOURCE_LANGUAGE_CODES
    ),
    translatorBatchSize: toPositiveInteger(raw.translatorBatchSize, DEFAULT_TRANSLATOR_BATCH_SIZE),
    useLocalStremioProxy: toBoolean(raw.useLocalStremioProxy, true),
    enableEmbeddedSubtitles: toBoolean(raw.enableEmbeddedSubtitles, true),
    stremioEngineUrl: safeNormalizeEngineUrl(raw.stremioEngineUrl, DEFAULT_STREMIO_ENGINE_URL)
  };
}

function encodeConfigSegment(config) {
  return base64UrlEncode(JSON.stringify(normalizeConfig(config)));
}

function decodeConfigSegment(segment) {
  if (!segment) {
    return normalizeConfig();
  }

  try {
    return normalizeConfig(JSON.parse(base64UrlDecode(segment)));
  } catch (error) {
    return normalizeConfig();
  }
}

function configHash(config) {
  return createHash("sha256")
    .update(JSON.stringify(normalizeConfig(config)))
    .digest("hex")
    .slice(0, 12);
}

function manifestUrlToBaseUrl(manifestUrl) {
  return normalizeManifestUrl(manifestUrl).replace(/\/manifest\.json$/i, "");
}

module.exports = {
  DEFAULT_DISPLAY_LANGUAGE,
  DEFAULT_SOURCE_LANGUAGE_CODES,
  DEFAULT_STREMIO_ENGINE_URL,
  DEFAULT_TARGET_LANGUAGE_CODE,
  DEFAULT_TRANSLATOR_BATCH_SIZE,
  base64UrlDecode,
  base64UrlEncode,
  configHash,
  decodeConfigSegment,
  encodeConfigSegment,
  manifestUrlToBaseUrl,
  normalizeConfig,
  normalizeManifestUrl
};
