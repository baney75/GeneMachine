const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const { chromium, webkit } = require("playwright");

const root = path.resolve(__dirname, "..");
const mimeTypes = new Map([
  [".css", "text/css"],
  [".html", "text/html"],
  [".js", "text/javascript"],
  [".mjs", "text/javascript"],
  [".svg", "image/svg+xml"],
  [".tsv", "text/tab-separated-values"],
  [".txt", "text/plain"],
]);

function startServer() {
  const server = http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url, "http://127.0.0.1");
      let pathname = decodeURIComponent(requestUrl.pathname);
      if (pathname.endsWith("/")) pathname += "index.html";
      const filePath = path.resolve(root, `.${pathname}`);
      if (!filePath.startsWith(`${root}${path.sep}`)) throw new Error("Path outside project");
      const body = await fs.readFile(filePath);
      response.writeHead(200, { "content-type": mimeTypes.get(path.extname(filePath)) || "application/octet-stream" });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function verifyBrowser(browserType, baseUrl) {
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  const requests = [];
  page.on("request", (request) => requests.push(request.url()));

  await page.goto(`${baseUrl}/web/`);
  assert.equal(await page.locator("#file-input").isDisabled(), true);
  assert.equal(await page.locator("#drop-zone").isDisabled(), true);
  assert.match(await page.locator(".consent-row").innerText(), /local-only processing/i);
  assert.match(await page.locator(".consent-row").innerText(), /not uploaded or stored/i);

  const syntheticFixture = await fs.readFile(path.join(root, "samples/synthetic-ancestry.txt"));
  await page.locator("#file-input").setInputFiles({
    name: "blocked-before-consent.tsv",
    mimeType: "text/tab-separated-values",
    buffer: syntheticFixture,
  });
  await page.locator("#error-toast:not([hidden])").waitFor();
  assert.equal(await page.locator("#results").isHidden(), true);
  assert.equal(await page.locator("#file-input").inputValue(), "");
  assert.match(await page.locator("#error-toast").innerText(), /Consent to local-only processing/i);

  await page.locator("#consent-checkbox").check();
  assert.equal(await page.locator("#drop-zone").isEnabled(), true);
  const advanceFocus = browserType === webkit ? "Alt+Tab" : "Tab";
  await page.locator("#consent-checkbox").focus();
  await page.keyboard.press(advanceFocus);
  assert.equal(await page.evaluate(() => document.activeElement?.id), "drop-zone");
  await page.keyboard.press(advanceFocus);
  assert.equal(await page.evaluate(() => document.activeElement?.id), "demo-button");

  await page.keyboard.press("Enter");
  await page.locator("#results:not([hidden])").waitFor();
  assert.equal((await page.locator("#finding-badge").innerText()).trim(), "OBSERVATION SUPPORTED");

  const focusTrace = [];
  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press(advanceFocus);
    focusTrace.push(await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName));
  }
  for (const expected of ["export-button", "reset-button", "chromosome-chart"]) {
    assert.ok(focusTrace.includes(expected), `${browserType.name()} focus trace did not reach ${expected}: ${focusTrace.join(" -> ")}`);
  }

  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
  await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
  await page.evaluate(() => { document.documentElement.style.zoom = "1"; });
  await page.setViewportSize({ width: 720, height: 900 });
  const reflow720 = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  assert.deepEqual(reflow720, { innerWidth: 720, scrollWidth: 720 });
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
  assert.ok(requests.every((url) => new URL(url).hostname === "127.0.0.1"));

  await browser.close();
  return { browser: browserType.name(), focusTrace, reflow720 };
}

(async () => {
  const server = await startServer();
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    const results = [];
    for (const browserType of [chromium, webkit]) results.push(await verifyBrowser(browserType, baseUrl));
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
