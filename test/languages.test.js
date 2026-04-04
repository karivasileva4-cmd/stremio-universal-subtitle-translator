const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeSupportedTranslationLanguages } = require("../src/languages");

test("normalizeSupportedTranslationLanguages returns sorted language entries", () => {
  const languages = normalizeSupportedTranslationLanguages({
    translation: {
      fr: {
        name: "French",
        nativeName: "Francais",
        dir: "ltr"
      },
      ar: {
        name: "Arabic",
        nativeName: "العربية",
        dir: "rtl"
      }
    }
  });

  assert.deepEqual(languages, [
    {
      code: "ar",
      name: "Arabic",
      nativeName: "العربية",
      dir: "rtl"
    },
    {
      code: "fr",
      name: "French",
      nativeName: "Francais",
      dir: "ltr"
    }
  ]);
});
