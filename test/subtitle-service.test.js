const test = require("node:test");
const assert = require("node:assert/strict");

const { TTLCache } = require("../src/cache");
const { normalizeConfig, encodeConfigSegment } = require("../src/config");
const {
  buildEdgeTranslateUrl,
  buildTranslatedSubtitleEntries,
  fetchEmbeddedSubtitleCandidates,
  fetchEnglishSubtitleCandidates,
  getTranslatedSubtitleVtt
} = require("../src/subtitle-service");

test("fetchEnglishSubtitleCandidates keeps only english tracks", async () => {
  const config = normalizeConfig({
    sourceManifestUrls: ["https://source.example/manifest.json"]
  });

  const fakeFetch = async () => ({
    ok: true,
    json: async () => ({
      subtitles: [
        { id: "English WEB", lang: "eng", url: "https://cdn.example/eng.vtt" },
        { id: "Arabic", lang: "ara", url: "https://cdn.example/ara.vtt" }
      ]
    })
  });

  const candidates = await fetchEnglishSubtitleCandidates({
    config,
    type: "movie",
    id: "tt1234567",
    extra: {},
    fetchImpl: fakeFetch
  });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].subtitle.url, "https://cdn.example/eng.vtt");
});

test("fetchEmbeddedSubtitleCandidates returns embedded english tracks for matching local media", async () => {
  const config = normalizeConfig({
    enableEmbeddedSubtitles: true,
    stremioEngineUrl: "http://127.0.0.1:11470"
  });

  const fakeFetch = async () => ({
    ok: true,
    json: async () => ({
      abc123: {
        infoHash: "abc123",
        files: [
          {
            name: "Example Episode.mkv",
            length: 987654321,
            __cacheEvents: true
          }
        ]
      }
    })
  });

  const fakeExecFile = async () => ({
    stdout: JSON.stringify({
      streams: [
        {
          index: 2,
          codec_type: "subtitle",
          tags: {
            language: "eng",
            title: "Embedded English"
          }
        }
      ]
    })
  });

  const candidates = await fetchEmbeddedSubtitleCandidates({
    config,
    extra: {
      filename: "Example Episode.mkv",
      videoSize: "987654321"
    },
    fetchImpl: fakeFetch,
    execFileImpl: fakeExecFile
  });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].kind, "embedded");
  assert.equal(candidates[0].streamIndex, "2");
  assert.match(candidates[0].mediaUrl, /http:\/\/127\.0\.0\.1:11470\/abc123\/0/);
});

test("buildEdgeTranslateUrl uses the configured target language", () => {
  const config = normalizeConfig({
    targetLanguageCode: "fr-CA"
  });

  assert.equal(
    buildEdgeTranslateUrl(config),
    "https://edge.microsoft.com/translate/translatetext?from=en&to=fr-CA&isEnterpriseClient=false"
  );
});

test("translated subtitle entries expose the custom display language", () => {
  const config = normalizeConfig({
    sourceManifestUrls: ["https://source.example/manifest.json"],
    targetLanguageCode: "fr",
    displayLanguage: "Francais"
  });

  const entries = buildTranslatedSubtitleEntries({
    candidates: [
      {
        kind: "external",
        sourceManifestUrl: "https://source.example/manifest.json",
        subtitle: {
          id: "English WEB",
          lang: "eng",
          url: "https://cdn.example/sub.vtt"
        }
      }
    ],
    config,
    configSegment: encodeConfigSegment(config),
    originBaseUrl: "http://127.0.0.1:7001"
  });

  assert.equal(entries.length, 1);
  assert.equal(entries[0].lang, "Francais");
  assert.match(entries[0].url, /\/translated\//);
});

test("getTranslatedSubtitleVtt translates cue text with injected translator", async () => {
  const cache = new TTLCache();
  const config = normalizeConfig({
    sourceManifestUrls: ["https://source.example/manifest.json"],
    targetLanguageCode: "fr",
    useLocalStremioProxy: false
  });

  const fakeFetch = async () => ({
    ok: true,
    headers: {
      get: () => "text/plain; charset=utf-8"
    },
    arrayBuffer: async () =>
      Buffer.from(`1
00:00:01,000 --> 00:00:02,000
Hello world

2
00:00:03,000 --> 00:00:04,000
Thank you`)
  });

  const translated = await getTranslatedSubtitleVtt({
    config,
    payload: {
      kind: "external",
      sourceUrl: "https://cdn.example/episode.srt",
      sourceManifestUrl: "https://source.example/manifest.json"
    },
    fetchImpl: fakeFetch,
    translateImpl: async (texts) => texts.map((text) => `fr:${text}`),
    cache
  });

  assert.match(translated, /^WEBVTT/);
  assert.match(translated, /fr:Hello world/);
  assert.match(translated, /fr:Thank you/);
});

test("getTranslatedSubtitleVtt can translate extracted embedded subtitles", async () => {
  const cache = new TTLCache();
  const config = normalizeConfig({
    targetLanguageCode: "es",
    enableEmbeddedSubtitles: true
  });

  const translated = await getTranslatedSubtitleVtt({
    config,
    payload: {
      kind: "embedded",
      mediaUrl: "http://127.0.0.1:11470/abc123/0",
      streamIndex: "2",
      sourceManifestUrl: "embedded"
    },
    execFileImpl: async () => ({
      stdout: `WEBVTT

00:00:01.000 --> 00:00:02.000
Hello from embedded`
    }),
    translateImpl: async (texts) => texts.map((text) => `es:${text}`),
    cache
  });

  assert.match(translated, /^WEBVTT/);
  assert.match(translated, /es:Hello from embedded/);
});
