const { execFile } = require("node:child_process");
const path = require("node:path");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);

const DEFAULT_STREMIO_ENGINE_URL = process.env.STREMIO_ENGINE_URL || "http://127.0.0.1:11470";
const STATS_TIMEOUT_MS = 5000;
const FFPROBE_TIMEOUT_MS = 15000;
const FFMPEG_TIMEOUT_MS = 30000;
const EXEC_MAX_BUFFER = 16 * 1024 * 1024;

function normalizeEngineUrl(input = DEFAULT_STREMIO_ENGINE_URL) {
  const parsed = new URL(String(input).trim());

  if (!/^https?:$/i.test(parsed.protocol)) {
    throw new Error(`Only http(s) Stremio engine URLs are supported: ${input}`);
  }

  parsed.hash = "";
  parsed.search = "";
  parsed.pathname = parsed.pathname.replace(/\/+$/g, "") || "/";

  return parsed.toString().replace(/\/$/g, "");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeFilename(value) {
  return path
    .basename(String(value || ""))
    .toLowerCase()
    .replace(/\.[^.]+$/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function toPositiveInteger(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isPreferredLanguageLabel(label, languageCodes) {
  const normalized = String(label || "")
    .trim()
    .toLowerCase();

  if (!normalized) {
    return false;
  }

  return languageCodes.some((code) => {
    const candidate = String(code || "").trim().toLowerCase();

    return (
      normalized === candidate ||
      normalized.startsWith(`${candidate}-`) ||
      normalized.includes(` ${candidate} `) ||
      normalized.includes(`(${candidate})`)
    );
  });
}

function scoreActiveFile(file, requestInfo) {
  const fileName = normalizeFilename(file.name);
  const requestedName = normalizeFilename(requestInfo.filename);
  const requestedSize = toPositiveInteger(requestInfo.videoSize);
  let score = file.isCurrent ? 60 : 0;

  if (requestedName) {
    if (fileName === requestedName) {
      score += 120;
    } else if (fileName.includes(requestedName) || requestedName.includes(fileName)) {
      score += 45;
    }
  }

  if (requestedSize && Number(file.length) === requestedSize) {
    score += 90;
  } else if (requestedSize && Math.abs(Number(file.length) - requestedSize) <= 2048) {
    score += 40;
  }

  return score;
}

function createMediaUrl(engineUrl, infoHash, fileIndex) {
  return new URL(`/${infoHash}/${fileIndex}`, `${normalizeEngineUrl(engineUrl)}/`).toString();
}

async function fetchJsonWithTimeout(url, fetchImpl, timeoutMs = STATS_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      headers: {
        accept: "application/json"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Request failed (${response.status}) for ${url}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function listActiveMediaFiles(config, fetchImpl = fetch) {
  const statsUrl = new URL("/stats.json", `${normalizeEngineUrl(config.stremioEngineUrl)}/`).toString();
  const payload = await fetchJsonWithTimeout(statsUrl, fetchImpl);
  const torrents = Object.values(payload || {});

  return torrents.flatMap((torrent) =>
    (torrent.files || []).map((file, fileIndex) => ({
      infoHash: torrent.infoHash,
      fileIndex,
      name: file.name,
      length: file.length,
      isCurrent: Object.prototype.hasOwnProperty.call(file, "__cacheEvents")
    }))
  );
}

function pickRelevantMediaUrls(files, config, requestInfo) {
  const scored = files
    .map((file) => ({
      ...file,
      score: scoreActiveFile(file, requestInfo)
    }))
    .filter((file) => file.score > 0);

  const selected = scored.length > 0 ? scored : files.filter((file) => file.isCurrent);
  const fallback = selected.length > 0 ? selected : files.slice(0, 1);

  return unique(
    fallback
      .sort((left, right) => right.score - left.score || Number(right.isCurrent) - Number(left.isCurrent))
      .slice(0, 3)
      .map((file) => createMediaUrl(config.stremioEngineUrl, file.infoHash, file.fileIndex))
  );
}

function createExecutableCandidates(commandName, overridePath) {
  const windowsStremioBinary =
    process.platform === "win32" && process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, "Programs", "Stremio", `${commandName}.exe`)
      : null;

  const envOverride =
    commandName === "ffprobe" ? process.env.FFPROBE_PATH : commandName === "ffmpeg" ? process.env.FFMPEG_PATH : null;

  return unique([
    overridePath,
    envOverride,
    windowsStremioBinary,
    commandName,
    process.platform === "win32" ? `${commandName}.exe` : null
  ]);
}

async function execWithCandidates(commandName, args, options = {}, overridePath, execFileImpl = execFileAsync) {
  const candidates = createExecutableCandidates(commandName, overridePath);
  let lastError;

  for (const candidate of candidates) {
    try {
      return await execFileImpl(candidate, args, {
        windowsHide: true,
        maxBuffer: EXEC_MAX_BUFFER,
        ...options
      });
    } catch (error) {
      lastError = error;

      if (error && (error.code === "ENOENT" || error.code === "UNKNOWN")) {
        continue;
      }

      throw error;
    }
  }

  throw lastError || new Error(`Unable to locate ${commandName}`);
}

async function probeEmbeddedSubtitleStreams(
  mediaUrl,
  config,
  execFileImpl = execFileAsync,
  probePathOverride = null
) {
  const { stdout } = await execWithCandidates(
    "ffprobe",
    [
      "-v",
      "error",
      "-probesize",
      "200000",
      "-analyzeduration",
      "1000000",
      "-show_entries",
      "stream=index,codec_type:stream_tags=language,title",
      "-of",
      "json",
      mediaUrl
    ],
    {
      timeout: FFPROBE_TIMEOUT_MS
    },
    probePathOverride,
    execFileImpl
  );

  const payload = JSON.parse(stdout || "{}");

  return (payload.streams || [])
    .filter((stream) => stream && stream.codec_type === "subtitle")
    .filter((stream) => {
      const tags = stream.tags || {};
      return (
        isPreferredLanguageLabel(tags.language, config.sourceLanguageCodes) ||
        isPreferredLanguageLabel(tags.title, config.sourceLanguageCodes)
      );
    })
    .map((stream) => ({
      mediaUrl,
      streamIndex: String(stream.index),
      title: stream.tags && stream.tags.title ? String(stream.tags.title) : null,
      language: stream.tags && stream.tags.language ? String(stream.tags.language) : null
    }));
}

async function discoverEmbeddedSubtitleCandidates({
  config,
  requestInfo,
  fetchImpl = fetch,
  execFileImpl = execFileAsync
}) {
  if (!config.enableEmbeddedSubtitles) {
    return [];
  }

  let files;

  try {
    files = await listActiveMediaFiles(config, fetchImpl);
  } catch (error) {
    return [];
  }

  const mediaUrls = pickRelevantMediaUrls(files, config, requestInfo);
  const batches = await Promise.allSettled(
    mediaUrls.map((mediaUrl) => probeEmbeddedSubtitleStreams(mediaUrl, config, execFileImpl))
  );

  return batches
    .filter((batch) => batch.status === "fulfilled")
    .flatMap((batch) => batch.value)
    .map((stream, index) => ({
      kind: "embedded",
      sourceManifestUrl: "embedded",
      subtitle: {
        id: stream.title || stream.language || `Embedded subtitle ${index + 1}`,
        lang: stream.language || "eng",
        label: stream.title || "Embedded subtitle"
      },
      mediaUrl: stream.mediaUrl,
      streamIndex: stream.streamIndex,
      title: stream.title,
      language: stream.language
    }));
}

async function extractEmbeddedSubtitleText(
  payload,
  execFileImpl = execFileAsync,
  ffmpegPathOverride = null
) {
  const { stdout } = await execWithCandidates(
    "ffmpeg",
    [
      "-v",
      "error",
      "-nostdin",
      "-i",
      payload.mediaUrl,
      "-map",
      `0:${payload.streamIndex}`,
      "-c:s",
      "webvtt",
      "-f",
      "webvtt",
      "-"
    ],
    {
      timeout: FFMPEG_TIMEOUT_MS
    },
    ffmpegPathOverride,
    execFileImpl
  );

  if (!String(stdout || "").trim()) {
    throw new Error("FFmpeg returned an empty embedded subtitle track");
  }

  return stdout;
}

module.exports = {
  DEFAULT_STREMIO_ENGINE_URL,
  createMediaUrl,
  discoverEmbeddedSubtitleCandidates,
  extractEmbeddedSubtitleText,
  normalizeEngineUrl
};
