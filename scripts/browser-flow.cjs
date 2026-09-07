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

  for (const fileName of [
    "ancestry-full-header-grch37-forward.tsv",
    "23andme-full-header-grch37-plus.tsv",
  ]) {
    await page.locator("#file-input").setInputFiles(path.join(root, "samples", "reference", fileName));
    await page.locator("#results:not([hidden])").waitFor();
    assert.equal((await page.locator("#finding-badge").innerText()).trim(), "OBSERVATION SUPPORTED", `${browserType.name()} ${fileName}`);
    assert.match(await page.locator("#evidence-ladder").innerText(), /rs4149056 T\/C/, `${browserType.name()} ${fileName}`);
  }

  for (const fileName of [
    "ancestry-full-header-grch37-forward.tsv",
    "23andme-full-header-grch37-plus.tsv",
  ]) {
    const source = await fs.readFile(path.join(root, "samples", "reference", fileName), "utf8");
    const withStandaloneUnverified = source.replace(/\n(?=rsid\t)/, "\n# unverified\n");
    await page.locator("#file-input").setInputFiles({
      name: `unverified-${fileName}`,
      mimeType: "text/tab-separated-values",
      buffer: Buffer.from(withStandaloneUnverified),
    });
    await page.locator("#results:not([hidden])").waitFor();
    assert.equal((await page.locator("#finding-badge").innerText()).trim(), "ABSTAINED", `${browserType.name()} standalone unverified ${fileName}`);
    assert.match(await page.locator("#status-detail").innerText(), /Forward \/ plus strand orientation must be explicitly declared/, `${browserType.name()} standalone unverified ${fileName}`);
  }

  const nounFirstSymbolConflict = Buffer.from("# Synthetic fixture with no person\n# build 37\n# orientation: +; orientation: -\nrsid\tchromosome\tposition\tgenotype\nrs4149056\t12\t21331549\tTC");
  await page.locator("#file-input").setInputFiles({
    name: "noun-first-symbol-conflict.tsv",
    mimeType: "text/tab-separated-values",
    buffer: nounFirstSymbolConflict,
  });
  await page.locator("#results:not([hidden])").waitFor();
  assert.equal((await page.locator("#finding-badge").innerText()).trim(), "ABSTAINED", `${browserType.name()} noun-first symbol conflict`);
  assert.match(await page.locator("#metric-grid").innerText(), /Orientation\s+Unverified/i, `${browserType.name()} noun-first symbol conflict orientation`);
  assert.match(await page.locator("#status-detail").innerText(), /Forward \/ plus strand orientation must be explicitly declared/, `${browserType.name()} noun-first symbol conflict stop`);

  await page.locator("#file-input").setInputFiles(path.join(root, "samples", "reference", "ancestry-full-header-wrapped-conflict.tsv"));
  await page.locator("#results:not([hidden])").waitFor();
  assert.equal((await page.locator("#finding-badge").innerText()).trim(), "ABSTAINED", `${browserType.name()} wrapped ambiguity`);
  assert.match(await page.locator("#status-detail").innerText(), /Forward \/ plus strand orientation must be explicitly declared/, `${browserType.name()} wrapped ambiguity`);

  await page.locator("#file-input").setInputFiles({
    name: "ancestry-explicit-forward-plus.txt",
    mimeType: "text/plain",
    buffer: syntheticFixture,
  });
  await page.locator("#results:not([hidden])").waitFor();
  assert.equal((await page.locator("#finding-badge").innerText()).trim(), "OBSERVATION SUPPORTED");
  assert.match(await page.locator("#evidence-ladder").innerText(), /rs4149056 T\/C/);
  const providerUncertainty = await page.locator("#warning-list").innerText();
  assert.match(providerUncertainty, /Analytical and clinical confirmation are outside this software's validated scope/);

  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export-button").click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), "genemachine-discussion-report.html");
  const downloadedPath = await download.path();
  const downloadedHtml = await fs.readFile(downloadedPath, "utf8");
  const reportPage = await context.newPage();
  await reportPage.setViewportSize({ width: 390, height: 844 });
  await reportPage.setContent(downloadedHtml, { waitUntil: "load" });
  const phoneReport = await reportPage.evaluate(() => {
    const hashCell = [...document.querySelectorAll(".meta div")].find((element) => element.querySelector("span")?.textContent === "LOCAL INPUT SHA-256");
    const hash = hashCell ? [...hashCell.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent).join("").trim() : "";
    return {
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      hash,
      hashSelectable: hashCell ? getComputedStyle(hashCell).userSelect !== "none" : false,
    };
  });
  assert.equal(phoneReport.scrollWidth, phoneReport.clientWidth, `${browserType.name()} report overflowed at 390px`);
  assert.match(phoneReport.hash, /^[a-f0-9]{64}$/, `${browserType.name()} report did not preserve the full SHA-256`);
  assert.equal(phoneReport.hashSelectable, true, `${browserType.name()} report hash was not selectable`);

  await reportPage.setViewportSize({ width: 720, height: 900 });
  await reportPage.evaluate(() => { document.documentElement.style.zoom = "2"; });
  const zoomedReport = await reportPage.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  assert.equal(zoomedReport.scrollWidth, zoomedReport.clientWidth, `${browserType.name()} report overflowed at 200% zoom / 720px`);

  await reportPage.evaluate(() => { document.documentElement.style.zoom = "1"; });
  await reportPage.setViewportSize({ width: 1280, height: 900 });
  const desktopReport = await reportPage.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    mainWidth: document.querySelector("main").getBoundingClientRect().width,
  }));
  assert.equal(desktopReport.scrollWidth, desktopReport.clientWidth, `${browserType.name()} report overflowed on desktop`);
  assert.ok(desktopReport.mainWidth <= 820, `${browserType.name()} report exceeded its desktop reading measure`);

  await reportPage.emulateMedia({ media: "print" });
  const printReport = await reportPage.evaluate(() => ({
    bodyBackground: getComputedStyle(document.body).backgroundColor,
    mainShadow: getComputedStyle(document.querySelector("main")).boxShadow,
    metaBreak: getComputedStyle(document.querySelector(".meta")).breakInside,
    headings: [...document.querySelectorAll("h1,h2")].every((heading) => heading.getBoundingClientRect().height > 0),
  }));
  assert.equal(printReport.bodyBackground, "rgb(255, 255, 255)", `${browserType.name()} report print background`);
  assert.equal(printReport.mainShadow, "none", `${browserType.name()} report print shadow`);
  assert.equal(printReport.metaBreak, "avoid", `${browserType.name()} report metadata print break`);
  assert.equal(printReport.headings, true, `${browserType.name()} report print headings`);
  await reportPage.close();

  await page.locator("#reset-button").click();
  await page.locator("#demo-button").click();
  await page.locator("#results:not([hidden])").waitFor();
  assert.equal(await page.locator("#warning-list").innerText(), providerUncertainty);

  const focusTrace = [];
  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press(advanceFocus);
    focusTrace.push(await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName));
  }
  for (const expected of ["export-button", "reset-button", "chromosome-chart"]) {
    assert.ok(focusTrace.includes(expected), `${browserType.name()} focus trace did not reach ${expected}: ${focusTrace.join(" -> ")}`);
  }

  for (const [index, declaration] of [
    "not forward strand",
    "no forward strand",
    "without a plus strand declaration",
    "non-forward strand",
    "unforward strand",
    "not plus strand",
    "possibly forward strand",
    "reverse-forward strand",
    "reverse / forward strand",
    "minus or plus orientation",
  ].entries()) {
    const contraryFixture = Buffer.from(`# Synthetic fixture; no person\n# AncestryDNA raw data\n# build 37\n# ${declaration}\nrsid\tchromosome\tposition\tallele1\tallele2\nrs4149056\t12\t21331549\tT\tC`);
    await page.locator("#file-input").setInputFiles({
      name: `contrary-orientation-${index}.txt`,
      mimeType: "text/plain",
      buffer: contraryFixture,
    });
    await page.locator("#results:not([hidden])").waitFor();
    assert.equal((await page.locator("#finding-badge").innerText()).trim(), "ABSTAINED", declaration);
    assert.match(await page.locator("#status-detail").innerText(), /Forward \/ plus strand orientation must be explicitly declared/, declaration);
  }
  for (const [index, comments] of [
    ["orientation is unknown", "forward strand"],
    ["no forward strand", "orientation: +"],
    ["forward strand", "orientation is unknown"],
    ["- / + strand"],
    ["maybe + strand"],
    ["forward strand; unknown"],
    ["forward strand. unknown"],
    ["forward strand; not confirmed"],
    ["not; forward strand"],
    [`not ${"filler ".repeat(16)}forward strand`],
    ["perhaps forward strand"],
    ["unknown", "forward strand"],
    ["forward strand?"],
    ["unverified forward strand"],
    ["forward strand remains unverified"],
    ["tentative forward strand"],
    ["provisional forward strand"],
    ["likely forward strand"],
    ["probably forward strand"],
    ["+ strand; provisional"],
  ].entries()) {
    const ambiguousFixture = Buffer.from(`# Synthetic fixture; no person\n# AncestryDNA raw data\n# build 37\n${comments.map((comment) => `# ${comment}`).join("\n")}\nrsid\tchromosome\tposition\tallele1\tallele2\nrs4149056\t12\t21331549\tT\tC`);
    await page.locator("#file-input").setInputFiles({
      name: `ambiguous-orientation-${index}.txt`,
      mimeType: "text/plain",
      buffer: ambiguousFixture,
    });
    await page.locator("#results:not([hidden])").waitFor();
    assert.equal((await page.locator("#finding-badge").innerText()).trim(), "ABSTAINED", comments.join(" / "));
    assert.match(await page.locator("#status-detail").innerText(), /Forward \/ plus strand orientation must be explicitly declared/, comments.join(" / "));
  }
  for (const [index, text] of [
    `# Synthetic fixture; no person\n# AncestryDNA raw data\n# build 37\n# forward strand\n# ${"x".repeat(510)} reverse strand\nrsid\tchromosome\tposition\tallele1\tallele2\nrs4149056\t12\t21331549\tT\tC`,
    "# Synthetic fixture; no person\n# AncestryDNA raw data\n# build 37\n# forward strand\nrsid\tchromosome\tposition\tallele1\tallele2\n# reverse strand\nrs4149056\t12\t21331549\tT\tC",
  ].entries()) {
    await page.locator("#file-input").setInputFiles({
      name: `late-or-post-column-contradiction-${index}.txt`,
      mimeType: "text/plain",
      buffer: Buffer.from(text),
    });
    await page.locator("#results:not([hidden])").waitFor();
    assert.equal((await page.locator("#finding-badge").innerText()).trim(), "ABSTAINED");
  }
  for (const [index, text] of [
    "# Synthetic fixture - no person\n# AncestryDNA raw data\n# build 37\n# forward strand\nrsid\tchromosome\tposition\tallele1\tallele2\n\u200B# reverse strand\nrs4149056\t12\t21331549\tT\tC",
    "# Synthetic fixture - no person\n# AncestryDNA raw data\n# build 37\n# forward strand\nrsid\tchromosome\tposition\tallele1\tallele2\n# rev\u200Berse str\u200Band\nrs4149056\t12\t21331549\tT\tC",
  ].entries()) {
    await page.locator("#file-input").setInputFiles({
      name: `unicode-orientation-${index}.txt`,
      mimeType: "text/plain",
      buffer: Buffer.from(text),
    });
    await page.locator("#error-toast:not([hidden])").waitFor();
    assert.equal(await page.locator("#results").isHidden(), true);
    assert.match(await page.locator("#error-toast").innerText(), /unsupported non-printing or non-ASCII formatting/);
  }
  for (const [index, text] of [
    "# Synthetic fixture - no person\n# AncestryDNA raw data\n# build 37\n# forward strand\nrsid\tchromosome\tposition\tallele1\tallele2\n# rev\rerse str\rand\nrs4149056\t12\t21331549\tT\tC",
    "# Synthetic fixture - no person\n# AncestryDNA raw data\n# build 37\n# forward strand\nrsid\tchromosome\tposition\tallele1\tallele2\n# rev\terse str\tand\nrs4149056\t12\t21331549\tT\tC",
  ].entries()) {
    await page.locator("#file-input").setInputFiles({
      name: `control-formatting-orientation-${index}.txt`,
      mimeType: "text/plain",
      buffer: Buffer.from(text),
    });
    await page.locator("#error-toast:not([hidden])").waitFor();
    assert.equal(await page.locator("#results").isHidden(), true);
    assert.match(await page.locator("#error-toast").innerText(), /unsupported non-printing or non-ASCII formatting/);
  }
  await page.locator("#demo-button").click();
  await page.locator("#results:not([hidden])").waitFor();

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
  return {
    browser: browserType.name(),
    downloadedReport: {
      phone: { clientWidth: phoneReport.clientWidth, scrollWidth: phoneReport.scrollWidth, hashLength: phoneReport.hash.length, hashSelectable: phoneReport.hashSelectable },
      zoom200: zoomedReport,
      desktop: desktopReport,
      print: printReport,
    },
    focusTrace,
    reflow720,
  };
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
