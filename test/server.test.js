const test = require("node:test");
const assert = require("node:assert/strict");

const { encodeConfigSegment, normalizeConfig } = require("../src/config");
const { createServer } = require("../src/server");

test("server handles subtitle route without extra args", async () => {
  const config = normalizeConfig({
    enableEmbeddedSubtitles: false
  });
  const configSegment = encodeConfigSegment(config);
  const server = createServer();

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const { port } = server.address();
    const response = await fetch(
      `http://127.0.0.1:${port}/${configSegment}/subtitles/movie/tt1234567.json`
    );
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(payload, { subtitles: [] });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("configure page includes target language selector", async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/configure`);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(html, /Target Translation Language/);
    assert.match(html, /targetLanguageCode/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
