const { configHash } = require("./config");

const BASE_ID = "community.universal.subtitle.translator";
const BASE_NAME = "Universal Subtitle Translator";

function createManifest(config) {
  const configured =
    (Array.isArray(config.sourceManifestUrls) && config.sourceManifestUrls.length > 0) ||
    config.enableEmbeddedSubtitles;

  return {
    id: `${BASE_ID}.${configHash(config)}`,
    version: "0.1.0",
    name: BASE_NAME,
    description:
      "Translates English subtitle tracks into any Microsoft Translator target language, with optional embedded subtitle fallback.",
    logo: "https://stremio.com/website/stremio-logo-small.png",
    resources: [
      {
        name: "subtitles",
        types: ["movie", "series", "channel", "tv"]
      }
    ],
    types: ["movie", "series", "channel", "tv"],
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
