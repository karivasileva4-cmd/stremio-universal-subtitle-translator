const test = require("node:test");
const assert = require("node:assert/strict");

const {
  decodeConfigSegment,
  encodeConfigSegment,
  normalizeConfig,
  normalizeManifestUrl
} = require("../src/config");

test("normalizeManifestUrl appends manifest.json when missing", () => {
  assert.equal(
    normalizeManifestUrl("https://example.com/subtitles"),
    "https://example.com/subtitles/manifest.json"
  );
});

test("config encoding round-trips universal translator values", () => {
  const source = normalizeConfig({
    sourceManifestUrls: ["https://example.com/addon"],
    targetLanguageCode: "fr",
    displayLanguage: "Francais",
    sourceLanguageCodes: "eng, en",
    translatorBatchSize: "40",
    useLocalStremioProxy: "true",
    enableEmbeddedSubtitles: "true",
    stremioEngineUrl: "http://127.0.0.1:11470/"
  });

  const decoded = decodeConfigSegment(encodeConfigSegment(source));

  assert.deepEqual(decoded, {
    sourceManifestUrls: ["https://example.com/addon/manifest.json"],
    targetLanguageCode: "fr",
    displayLanguage: "Francais",
    sourceLanguageCodes: ["eng", "en"],
    translatorBatchSize: 40,
    useLocalStremioProxy: true,
    enableEmbeddedSubtitles: true,
    stremioEngineUrl: "http://127.0.0.1:11470"
  });
});
