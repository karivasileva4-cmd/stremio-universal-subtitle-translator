const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeConfig } = require("../src/config");
const { createManifest } = require("../src/manifest");

test("manifest does not require configuration when embedded subtitles are enabled", () => {
  const manifest = createManifest(
    normalizeConfig({
      sourceManifestUrls: [],
      enableEmbeddedSubtitles: true
    })
  );

  assert.equal(manifest.behaviorHints.configurationRequired, false);
  assert.equal(manifest.name, "Universal Subtitle Translator");
  assert.match(manifest.id, /^community\.universal\.subtitle\.translator\./);
});
