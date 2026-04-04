function normalizeSubtitleText(text) {
  return String(text || "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n");
}

function hasTimingLine(line) {
  return /^\s*(?:\d{2}:)?\d{2}:\d{2}[.,]\d{3}\s+-->\s+(?:\d{2}:)?\d{2}:\d{2}[.,]\d{3}/.test(line);
}

function parseSubtitleDocument(text) {
  const normalized = normalizeSubtitleText(text);
  const rawBlocks = normalized.split(/\n{2,}/);
  const blocks = rawBlocks
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n");
      const timingIndex = lines.findIndex(hasTimingLine);

      if (timingIndex === -1) {
        return {
          type: "raw",
          lines
        };
      }

      return {
        type: "cue",
        prefixLines: lines.slice(0, timingIndex),
        timingLine: lines[timingIndex],
        text: lines.slice(timingIndex + 1).join("\n")
      };
    });

  return {
    format: normalized.startsWith("WEBVTT") ? "vtt" : "srt",
    blocks
  };
}

function normalizeTimingLineForVtt(timingLine) {
  return timingLine.replace(/,/g, ".");
}

function shouldKeepPrefixLine(line) {
  return !/^\d+$/.test(String(line || "").trim());
}

function renderBlocksAsVtt(blocks) {
  const renderedBlocks = [];

  for (const block of blocks) {
    if (block.type === "raw") {
      const rawText = block.lines.join("\n").trim();

      if (!rawText || rawText === "WEBVTT") {
        continue;
      }

      renderedBlocks.push(rawText);
      continue;
    }

    const prefixLines = (block.prefixLines || []).filter(shouldKeepPrefixLine);
    const cueText = String(block.text || "").trimEnd();
    const cueLines = [
      ...prefixLines,
      normalizeTimingLineForVtt(block.timingLine),
      cueText
    ].filter((line, index, array) => line !== "" || index !== array.length - 1);

    renderedBlocks.push(cueLines.join("\n"));
  }

  return `WEBVTT\n\n${renderedBlocks.join("\n\n")}\n`;
}

function extractCueTexts(document) {
  return document.blocks
    .filter((block) => block.type === "cue")
    .map((block) => block.text || "");
}

function applyTranslatedCueTexts(document, translatedCueTexts) {
  const cueTexts = [...translatedCueTexts];

  return {
    format: "vtt",
    blocks: document.blocks.map((block) => {
      if (block.type !== "cue") {
        return block;
      }

      return {
        ...block,
        text: cueTexts.shift() || block.text
      };
    })
  };
}

module.exports = {
  applyTranslatedCueTexts,
  extractCueTexts,
  normalizeSubtitleText,
  parseSubtitleDocument,
  renderBlocksAsVtt
};
