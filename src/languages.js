const MICROSOFT_TRANSLATOR_LANGUAGES_URL =
  "https://api.cognitive.microsofttranslator.com/languages?api-version=3.0&scope=translation";

function normalizeLanguageEntry(code, entry) {
  return {
    code,
    name: String(entry && entry.name ? entry.name : code),
    nativeName: String(entry && entry.nativeName ? entry.nativeName : entry && entry.name ? entry.name : code),
    dir: String(entry && entry.dir ? entry.dir : "ltr")
  };
}

function sortLanguages(languages) {
  return [...languages].sort((left, right) =>
    `${left.name} ${left.nativeName}`.localeCompare(`${right.name} ${right.nativeName}`, "en", {
      sensitivity: "base"
    })
  );
}

function normalizeSupportedTranslationLanguages(payload) {
  const translation = payload && payload.translation ? payload.translation : {};

  return sortLanguages(
    Object.entries(translation).map(([code, entry]) => normalizeLanguageEntry(code, entry))
  );
}

async function fetchSupportedTranslationLanguages(fetchImpl = fetch) {
  const response = await fetchImpl(MICROSOFT_TRANSLATOR_LANGUAGES_URL, {
    headers: {
      accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Microsoft Translator languages (${response.status})`);
  }

  return normalizeSupportedTranslationLanguages(await response.json());
}

module.exports = {
  MICROSOFT_TRANSLATOR_LANGUAGES_URL,
  fetchSupportedTranslationLanguages,
  normalizeSupportedTranslationLanguages
};
