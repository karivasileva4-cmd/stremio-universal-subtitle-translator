# Universal Subtitle Translator for Stremio

Universal Subtitle Translator is a Stremio subtitle add-on that:

- translates English subtitle tracks into any supported Microsoft Translator target language
- supports external subtitle add-ons and embedded English subtitle fallback
- exposes the translated result back to Stremio as a selectable subtitle language
- runs locally with no npm dependencies

## Features

- Target language selector powered by the official Microsoft Translator supported-languages endpoint
- Custom `Subtitle Language Label` so you can decide what Stremio shows in the subtitle picker
- Optional source subtitle add-on manifests for external English subtitle fallback
- Optional local-engine embedded subtitle fallback through the Stremio desktop engine
- UTF-8 WebVTT output
- Translation result caching

## How It Works

1. Stremio asks this add-on for subtitles for a movie or episode.
2. The add-on looks for English subtitle tracks from any configured subtitle add-ons.
3. If needed, it also tries to detect English embedded subtitle tracks from the local Stremio engine.
4. When you select the generated subtitle language in Stremio, the add-on fetches the original English subtitle text.
5. It sends subtitle cue text to the Microsoft Edge translation endpoint.
6. It returns translated WebVTT subtitles back to Stremio.

## Supported Target Languages

The configure page loads the target-language list from the official Microsoft Translator languages endpoint:

- [Microsoft Translator supported languages endpoint](https://api.cognitive.microsofttranslator.com/languages?api-version=3.0&scope=translation)
- [Microsoft Learn Translator reference](https://learn.microsoft.com/azure/ai-services/translator/text-translation/reference/rest-api-guide)

This means the add-on can follow the currently available Microsoft Translator language list instead of hardcoding only one target language.

## Folder Structure

This universal version lives in:

`C:\Users\{YOUR USERNAME}\Documents\idk\stremio-universal-subtitle-translator`

The original Kurdish Sorani-specific version is left untouched in the original folder.

## Run It

From this folder:

```powershell
node C:\Users\{YOUR USERNAME}\Documents\idk\stremio-universal-subtitle-translator\src\server.js
```

The universal clone defaults to:

- Add-on server: `http://127.0.0.1:7001`
- Configure page: `http://127.0.0.1:7001/configure`
- Language list route: `http://127.0.0.1:7001/languages.json`

The port is `7001` by default so it can coexist with the original Sorani-only add-on on `7000`.

## Configure And Install

1. Start the server.
2. Open `http://127.0.0.1:7001/configure`.
3. Pick a target translation language.
4. Set the `Subtitle Language Label` you want Stremio to show.
5. Optionally paste subtitle add-on manifest URLs for external English subtitles.
6. Keep embedded fallback enabled if you want local Stremio engine subtitle extraction.
7. Click `Build Manifest URL`.
8. Install the generated manifest URL in Stremio.

  ```Watch My Youtube Video Tutorial
  https://youtu.be/nLytVXyluMg --> (Watch My Youtube Video Tutorial)
  ```
## Configuration Fields

- `targetLanguageCode`: Microsoft Translator target language code
- `displayLanguage`: label shown in Stremio
- `sourceManifestUrls`: external subtitle add-on manifest URLs
- `sourceLanguageCodes`: which subtitle language labels count as English
- `translatorBatchSize`: how many subtitle cues to send per translation request
- `useLocalStremioProxy`: whether to try the local Stremio subtitle conversion proxy first
- `enableEmbeddedSubtitles`: whether to inspect the local Stremio engine for embedded English subtitle tracks
- `stremioEngineUrl`: local Stremio engine URL, usually `http://127.0.0.1:11470`

## Notes

- This project is intentionally zero-dependency.
- The translation call uses the Microsoft Edge translation endpoint and may change without notice.
- Embedded subtitle fallback works best for text-based subtitle tracks.
- Image-based subtitle tracks such as PGS or VobSub will not translate cleanly without OCR.
- If you want to expose this publicly, remember that users still need a way to reach the add-on server URL you publish.

## Test

```powershell
node --test --test-isolation=none
```
