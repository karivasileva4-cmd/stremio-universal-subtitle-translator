const http = require("node:http");

const { TTLCache } = require("./cache");
const { decodeConfigSegment, encodeConfigSegment, normalizeConfig } = require("./config");
const { renderConfigurePage, renderHomePage } = require("./html");
const { fetchSupportedTranslationLanguages } = require("./languages");
const { createManifest } = require("./manifest");
const {
  buildTranslatedSubtitleEntries,
  decodeSubtitlePayload,
  fetchEmbeddedSubtitleCandidates,
  fetchEnglishSubtitleCandidates,
  getTranslatedSubtitleVtt,
  parseExtraArgs
} = require("./subtitle-service");

const cache = new TTLCache();
const LANGUAGE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function getOriginFromRequest(request) {
  const forwardedProto = request.headers["x-forwarded-proto"];
  const proto = forwardedProto ? String(forwardedProto).split(",")[0].trim() : "http";
  const host = request.headers["x-forwarded-host"] || request.headers.host || "127.0.0.1:7001";
  return `${proto}://${host}`;
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "*"
  });
  response.end(JSON.stringify(payload, null, 2));
}

function sendText(response, statusCode, text, contentType = "text/plain; charset=utf-8") {
  response.writeHead(statusCode, {
    "content-type": contentType,
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "*"
  });
  response.end(text);
}

function sendHtml(response, statusCode, html) {
  sendText(response, statusCode, html, "text/html; charset=utf-8");
}

async function getSupportedLanguages() {
  return cache.getOrCreate(
    "supported-languages",
    () => fetchSupportedTranslationLanguages(),
    LANGUAGE_CACHE_TTL_MS
  );
}

async function handleSubtitlesRequest({ request, response, configSegment, type, id, extraArgs }) {
  const config = decodeConfigSegment(configSegment);
  const originBaseUrl = getOriginFromRequest(request);

  const [externalCandidates, embeddedCandidates] = await Promise.all([
    fetchEnglishSubtitleCandidates({
      config,
      type,
      id,
      extra: extraArgs
    }),
    fetchEmbeddedSubtitleCandidates({
      config,
      extra: extraArgs
    })
  ]);

  const subtitles = buildTranslatedSubtitleEntries({
    candidates: externalCandidates.concat(embeddedCandidates),
    config,
    configSegment,
    originBaseUrl
  });

  sendJson(response, 200, { subtitles });
}

async function handleTranslatedSubtitleRequest({ response, configSegment, payloadSegment }) {
  const config = decodeConfigSegment(configSegment);
  const payload = decodeSubtitlePayload(payloadSegment);
  const translatedVtt = await getTranslatedSubtitleVtt({
    config,
    payload,
    cache
  });

  sendText(response, 200, translatedVtt, "text/vtt; charset=utf-8");
}

async function requestHandler(request, response) {
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "*"
    });
    response.end();
    return;
  }

  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Only GET is supported." });
    return;
  }

  const origin = getOriginFromRequest(request);
  const url = new URL(request.url, origin);
  const pathname = url.pathname.replace(/\/+$/g, "") || "/";
  const segments = pathname.split("/").filter(Boolean);

  try {
    if (pathname === "/") {
      sendHtml(response, 200, renderHomePage(origin));
      return;
    }

    if (pathname === "/configure") {
      const config = normalizeConfig({
        sourceManifestUrls: url.searchParams.getAll("sourceManifestUrls"),
        targetLanguageCode: url.searchParams.get("targetLanguageCode"),
        displayLanguage: url.searchParams.get("displayLanguage"),
        sourceLanguageCodes: url.searchParams.get("sourceLanguageCodes"),
        translatorBatchSize: url.searchParams.get("translatorBatchSize"),
        useLocalStremioProxy: url.searchParams.get("useLocalStremioProxy"),
        enableEmbeddedSubtitles: url.searchParams.get("enableEmbeddedSubtitles"),
        stremioEngineUrl: url.searchParams.get("stremioEngineUrl")
      });

      sendHtml(response, 200, renderConfigurePage(origin, config));
      return;
    }

    if (pathname === "/languages.json") {
      sendJson(response, 200, {
        languages: await getSupportedLanguages()
      });
      return;
    }

    if (pathname === "/manifest.json") {
      sendJson(response, 200, createManifest(normalizeConfig()));
      return;
    }

    if (segments.length === 2 && segments[1] === "manifest.json") {
      sendJson(response, 200, createManifest(decodeConfigSegment(segments[0])));
      return;
    }

    if (segments.length >= 4 && segments[1] === "subtitles") {
      const configSegment = segments[0];
      const type = decodeURIComponent(segments[2]);
      const rawIdSegment = segments[3];
      const id = decodeURIComponent(rawIdSegment.replace(/\.json$/i, ""));
      const extraSegment = segments[4] ? segments[4].replace(/\.json$/i, "") : "";
      const extraArgs = {
        ...Object.fromEntries(url.searchParams.entries()),
        ...parseExtraArgs(extraSegment)
      };

      await handleSubtitlesRequest({
        request,
        response,
        configSegment,
        type,
        id,
        extraArgs
      });
      return;
    }

    if (segments.length === 3 && segments[1] === "translated") {
      const configSegment = segments[0];
      const payloadSegment = segments[2].replace(/\.vtt$/i, "");
      await handleTranslatedSubtitleRequest({
        response,
        configSegment,
        payloadSegment
      });
      return;
    }

    sendJson(response, 404, { error: "Not found." });
  } catch (error) {
    sendJson(response, 500, {
      error: error.message || "Unexpected server error."
    });
  }
}

function createServer() {
  return http.createServer(requestHandler);
}

if (require.main === module) {
  const server = createServer();
  const host = process.env.HOST || "127.0.0.1";
  const port = Number.parseInt(process.env.PORT, 10) || 7001;

  server.listen(port, host, () => {
    const configSegment = encodeConfigSegment(normalizeConfig());
    console.log(`Universal Subtitle Translator listening on http://${host}:${port}`);
    console.log(`Configure: http://${host}:${port}/configure`);
    console.log(`Languages: http://${host}:${port}/languages.json`);
    console.log(`Manifest template: http://${host}:${port}/${configSegment}/manifest.json`);
  });
}

module.exports = {
  createServer,
  requestHandler
};
