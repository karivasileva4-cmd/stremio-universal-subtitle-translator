function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderHomePage(origin) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Universal Subtitle Translator</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #07131f;
        --panel: rgba(9, 17, 31, 0.86);
        --card: rgba(19, 31, 48, 0.88);
        --line: rgba(148, 163, 184, 0.22);
        --text: #e5eef8;
        --muted: #98abc1;
        --accent: #f59e0b;
        --accent-2: #22c55e;
      }

      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: "Segoe UI", Tahoma, sans-serif;
        background:
          radial-gradient(circle at top left, rgba(245, 158, 11, 0.18), transparent 36%),
          radial-gradient(circle at bottom right, rgba(34, 197, 94, 0.16), transparent 32%),
          linear-gradient(160deg, #030712 0%, #07131f 50%, #0f172a 100%);
        color: var(--text);
        display: grid;
        place-items: center;
        padding: 24px;
      }

      .panel {
        width: min(780px, 100%);
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 28px;
        padding: 32px;
        backdrop-filter: blur(16px);
        box-shadow: 0 24px 90px rgba(2, 6, 23, 0.5);
      }

      h1 {
        margin: 0 0 12px;
        font-size: clamp(2rem, 5vw, 3.1rem);
      }

      p {
        color: var(--muted);
        line-height: 1.7;
      }

      .card {
        margin-top: 24px;
        padding: 18px;
        border-radius: 18px;
        background: var(--card);
        border: 1px solid var(--line);
      }

      code {
        color: #fde68a;
      }

      .button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-top: 20px;
        padding: 12px 18px;
        border-radius: 999px;
        background: linear-gradient(135deg, var(--accent), var(--accent-2));
        color: #04111f;
        font-weight: 700;
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <main class="panel">
      <h1>Universal Subtitle Translator</h1>
      <p>
        This add-on translates English subtitle tracks into any supported Microsoft Translator
        target language and exposes them back to Stremio as a selectable subtitle option.
      </p>
      <div class="card">
        <p>
          Open the configure page, choose a target language, optionally add subtitle providers,
          and generate your installable manifest URL.
        </p>
        <p><code>${escapeHtml(origin)}/configure</code></p>
      </div>
      <a class="button" href="/configure">Open Configure Page</a>
    </main>
  </body>
</html>`;
}

function renderConfigurePage(origin, config) {
  const sourceManifestUrls = (config.sourceManifestUrls || []).join("\n");
  const sourceLanguageCodes = (config.sourceLanguageCodes || []).join(", ");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Configure Universal Subtitle Translator</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #07131f;
        --panel: rgba(9, 17, 31, 0.86);
        --line: rgba(148, 163, 184, 0.22);
        --text: #e5eef8;
        --muted: #98abc1;
        --accent: #f59e0b;
        --accent-2: #22c55e;
        --input: rgba(10, 18, 32, 0.95);
      }

      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: "Segoe UI", Tahoma, sans-serif;
        background:
          radial-gradient(circle at top left, rgba(245, 158, 11, 0.16), transparent 35%),
          radial-gradient(circle at bottom right, rgba(34, 197, 94, 0.12), transparent 30%),
          linear-gradient(160deg, #030712 0%, #07131f 52%, #0f172a 100%);
        color: var(--text);
        padding: 24px;
      }

      .layout {
        max-width: 1040px;
        margin: 0 auto;
        display: grid;
        gap: 24px;
      }

      .panel {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 24px;
        padding: 28px;
        backdrop-filter: blur(18px);
        box-shadow: 0 24px 90px rgba(2, 6, 23, 0.45);
      }

      h1, h2 {
        margin: 0 0 10px;
      }

      h1 {
        font-size: clamp(1.9rem, 5vw, 3rem);
      }

      p {
        color: var(--muted);
        line-height: 1.6;
      }

      form {
        display: grid;
        gap: 18px;
        margin-top: 18px;
      }

      label {
        display: grid;
        gap: 8px;
        font-weight: 700;
      }

      textarea,
      input[type="text"],
      input[type="number"],
      select {
        width: 100%;
        border: 1px solid var(--line);
        border-radius: 16px;
        background: var(--input);
        color: var(--text);
        padding: 14px 16px;
        font: inherit;
      }

      textarea {
        min-height: 132px;
        resize: vertical;
      }

      .grid {
        display: grid;
        gap: 18px;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      }

      .switch {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .hint {
        margin-top: -2px;
        font-size: 0.92rem;
        color: var(--muted);
        font-weight: 400;
      }

      .output {
        margin-top: 12px;
        padding: 16px;
        border-radius: 18px;
        border: 1px solid var(--line);
        background: rgba(10, 18, 32, 0.86);
      }

      .output code {
        display: block;
        overflow-wrap: anywhere;
        color: #fde68a;
      }

      .button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 0;
        border-radius: 999px;
        padding: 12px 18px;
        font: inherit;
        font-weight: 700;
        color: #04111f;
        background: linear-gradient(135deg, var(--accent), var(--accent-2));
        cursor: pointer;
        text-decoration: none;
      }

      .secondary {
        color: #93c5fd;
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <main class="layout">
      <section class="panel">
        <h1>Configure Universal Subtitle Translator</h1>
        <p>
          Choose a target translation language, decide what label Stremio should show in the subtitle
          picker, and optionally add subtitle add-on manifests for external English subtitle fallback.
        </p>

        <form id="config-form">
          <div class="grid">
            <label>
              Target Translation Language
              <select id="targetLanguageCode">
                <option value="${escapeHtml(config.targetLanguageCode || "ku")}">Loading supported languages...</option>
              </select>
              <span class="hint">Loaded from the official Microsoft Translator supported-language endpoint.</span>
            </label>

            <label>
              Subtitle Language Label
              <input id="displayLanguage" type="text" value="${escapeHtml(config.displayLanguage || "")}" />
              <span class="hint">This is what Stremio shows in the subtitle language list.</span>
            </label>

            <label>
              English Language Matchers
              <input id="sourceLanguageCodes" type="text" value="${escapeHtml(sourceLanguageCodes)}" />
            </label>

            <label>
              Translate Batch Size
              <input id="translatorBatchSize" type="number" min="1" max="100" value="${Number(config.translatorBatchSize || 25)}" />
            </label>

            <label>
              Local Stremio Engine URL
              <input id="stremioEngineUrl" type="text" value="${escapeHtml(config.stremioEngineUrl || "http://127.0.0.1:11470")}" />
            </label>
          </div>

          <label>
            Source Subtitle Add-on Manifest URLs
            <textarea id="sourceManifestUrls" spellcheck="false" placeholder="https://example.com/manifest.json">${escapeHtml(sourceManifestUrls)}</textarea>
            <span class="hint">Optional. Leave empty if you only want embedded subtitle fallback.</span>
          </label>

          <label class="switch">
            <input id="useLocalStremioProxy" type="checkbox" ${config.useLocalStremioProxy ? "checked" : ""} />
            Use the local Stremio subtitle proxy first for subtitle decoding and conversion
          </label>

          <label class="switch">
            <input id="enableEmbeddedSubtitles" type="checkbox" ${config.enableEmbeddedSubtitles ? "checked" : ""} />
            Fallback to English embedded subtitles from the local Stremio engine
          </label>

          <button class="button" type="submit">Build Manifest URL</button>
        </form>
      </section>

      <section class="panel">
        <h2>Manifest URL</h2>
        <p>
          Install this URL in Stremio. Each generated manifest is self-contained, so the selected
          language and subtitle label travel with the URL.
        </p>
        <div class="output">
          <code id="manifest-output"></code>
        </div>
        <p>
          Need the raw manifest too? <a class="secondary" id="open-manifest" href="#" target="_blank" rel="noreferrer">Open manifest.json</a>
        </p>
      </section>
    </main>

    <script>
      const origin = ${JSON.stringify(origin)};
      const initialConfig = ${JSON.stringify(config)};
      const form = document.getElementById("config-form");
      const targetLanguageCode = document.getElementById("targetLanguageCode");
      const sourceManifestUrls = document.getElementById("sourceManifestUrls");
      const displayLanguage = document.getElementById("displayLanguage");
      const sourceLanguageCodes = document.getElementById("sourceLanguageCodes");
      const translatorBatchSize = document.getElementById("translatorBatchSize");
      const stremioEngineUrl = document.getElementById("stremioEngineUrl");
      const useLocalStremioProxy = document.getElementById("useLocalStremioProxy");
      const enableEmbeddedSubtitles = document.getElementById("enableEmbeddedSubtitles");
      const manifestOutput = document.getElementById("manifest-output");
      const openManifest = document.getElementById("open-manifest");

      let supportedLanguages = [];
      let autoSyncDisplayLanguage = !displayLanguage.value.trim() || displayLanguage.value.trim() === (initialConfig.targetLanguageCode || "ku").toUpperCase();

      function base64UrlEncodeString(value) {
        const bytes = new TextEncoder().encode(value);
        let binary = "";
        for (const byte of bytes) {
          binary += String.fromCharCode(byte);
        }
        return btoa(binary).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/g, "");
      }

      function languageLabel(language) {
        if (!language) {
          return "";
        }

        return language.nativeName && language.nativeName !== language.name
          ? language.nativeName + " (" + language.name + ")"
          : language.name;
      }

      function defaultDisplayLanguage() {
        const selected = supportedLanguages.find((language) => language.code === targetLanguageCode.value);
        return selected ? languageLabel(selected) : (targetLanguageCode.value || "KU").toUpperCase();
      }

      function syncDisplayLanguageIfNeeded() {
        if (autoSyncDisplayLanguage) {
          displayLanguage.value = defaultDisplayLanguage();
        }
      }

      function currentConfig() {
        return {
          sourceManifestUrls: sourceManifestUrls.value
            .split(/\\n+/)
            .map((entry) => entry.trim())
            .filter(Boolean),
          targetLanguageCode: targetLanguageCode.value || "ku",
          displayLanguage: displayLanguage.value.trim() || defaultDisplayLanguage(),
          sourceLanguageCodes: sourceLanguageCodes.value,
          translatorBatchSize: Number.parseInt(translatorBatchSize.value, 10) || 25,
          stremioEngineUrl: stremioEngineUrl.value.trim() || "http://127.0.0.1:11470",
          useLocalStremioProxy: useLocalStremioProxy.checked,
          enableEmbeddedSubtitles: enableEmbeddedSubtitles.checked
        };
      }

      function updateManifestUrl() {
        const config = currentConfig();
        const segment = base64UrlEncodeString(JSON.stringify(config));
        const manifestUrl = origin.replace(/\\/$/, "") + "/" + segment + "/manifest.json";
        manifestOutput.textContent = manifestUrl;
        openManifest.href = manifestUrl;
      }

      async function loadSupportedLanguages() {
        try {
          const response = await fetch("/languages.json");
          const payload = await response.json();
          supportedLanguages = Array.isArray(payload.languages) ? payload.languages : [];

          const selectedCode = initialConfig.targetLanguageCode || "ku";
          targetLanguageCode.replaceChildren();

          supportedLanguages.forEach((language) => {
            const option = document.createElement("option");
            option.value = language.code;
            option.textContent = languageLabel(language) + " [" + language.code + "]";

            if (language.code === selectedCode) {
              option.selected = true;
            }

            targetLanguageCode.appendChild(option);
          });

          if (!supportedLanguages.some((language) => language.code === selectedCode)) {
            const option = document.createElement("option");
            option.value = selectedCode;
            option.selected = true;
            option.textContent = selectedCode.toUpperCase() + " [" + selectedCode + "]";
            targetLanguageCode.prepend(option);
          }

          syncDisplayLanguageIfNeeded();
          updateManifestUrl();
        } catch (error) {
          targetLanguageCode.replaceChildren();
          const option = document.createElement("option");
          option.value = initialConfig.targetLanguageCode || "ku";
          option.selected = true;
          option.textContent = (initialConfig.targetLanguageCode || "ku").toUpperCase();
          targetLanguageCode.appendChild(option);

          syncDisplayLanguageIfNeeded();
          updateManifestUrl();
        }
      }

      form.addEventListener("submit", (event) => {
        event.preventDefault();
        updateManifestUrl();
      });

      targetLanguageCode.addEventListener("change", () => {
        syncDisplayLanguageIfNeeded();
        updateManifestUrl();
      });

      displayLanguage.addEventListener("input", () => {
        autoSyncDisplayLanguage = false;
        updateManifestUrl();
      });

      sourceManifestUrls.addEventListener("input", updateManifestUrl);
      sourceLanguageCodes.addEventListener("input", updateManifestUrl);
      translatorBatchSize.addEventListener("input", updateManifestUrl);
      stremioEngineUrl.addEventListener("input", updateManifestUrl);
      useLocalStremioProxy.addEventListener("change", updateManifestUrl);
      enableEmbeddedSubtitles.addEventListener("change", updateManifestUrl);

      loadSupportedLanguages();
    </script>
  </body>
</html>`;
}

module.exports = {
  renderConfigurePage,
  renderHomePage
};
