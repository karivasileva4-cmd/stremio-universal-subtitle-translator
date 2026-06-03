const { configHash } = require("./config");

const BASE_ID = "community.universal.subtitle.translator";
const BASE_NAME = "Universal Subtitle Translator";

function createManifest(config) {
  const configured =
    (Array.isArray(config.sourceManifestUrls) && config.sourceManifestUrls.length > 0) ||
    config.enableEmbeddedSubtitles;

  return {
    id: `${BASE_ID}.${configHash(config)}`,
    version: "0.1.1",
    name: BASE_NAME,
    description:
      "Translates English subtitle tracks into any Microsoft Translator target language, with optional embedded subtitle fallback.",
    logo: "https://stremio.com/website/stremio-logo-small.png",
    resources: ["subtitles"],
    types: ["movie", "series"],
    catalogs: [],
    behaviorHints: {
      configurable: true,
      configurationRequired: !configured
    }
  };
}

module.exports = {
  createManifest
};
