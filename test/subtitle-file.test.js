const test = require("node:test");
const assert = require("node:assert/strict");

const {
  applyTranslatedCueTexts,
  extractCueTexts,
  parseSubtitleDocument,
  renderBlocksAsVtt
} = require("../src/subtitle-file");

test("subtitle parser extracts cue text and renders VTT", () => {
  const srt = `1
00:00:01,000 --> 00:00:03,000
Hello there

2
00:00:05,500 --> 00:00:08,100
General Kenobi`;

  const parsed = parseSubtitleDocument(srt);
  assert.equal(parsed.format, "srt");
  assert.deepEqual(extractCueTexts(parsed), ["Hello there", "General Kenobi"]);

  const translated = applyTranslatedCueTexts(parsed, ["Salut", "Bonjour"]);
  const vtt = renderBlocksAsVtt(translated.blocks);

  assert.match(vtt, /^WEBVTT/);
  assert.match(vtt, /00:00:01\.000 --> 00:00:03\.000/);
  assert.match(vtt, /Salut/);
  assert.match(vtt, /Bonjour/);
});
