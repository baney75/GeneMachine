const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createHash } = require('node:crypto');
const { chromium, webkit } = require('playwright');
const root = path.resolve(__dirname, '..');

async function startServer() {
  const child = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, GENEMACHINE_PORT: '0' } });
  const url = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', code => reject(new Error(`Local server exited ${code}`)));
    child.stdout.on('data', data => { const match = String(data).match(/http:\/\/127\.0\.0\.1:\d+/); if (match) resolve(match[0]); });
  });
  return { child, url };
}

async function verify(engine, url) {
  const browser = await engine.launch({ headless: true });
  try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const requests = [], errors = [];
  page.on('request', request => requests.push({ url: request.url(), method: request.method() }));
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  assert.match(page.url(), /\/web\/$/);
  await page.locator('.medicine-card').first().waitFor();
  assert.equal(await page.locator('.medicine-card').count(), 9);
  assert.equal(await page.locator('#consent-checkbox').isChecked(), false);

  await page.locator('#medicine-search').fill('Plavix');
  assert.equal(await page.locator('.medicine-card').count(), 1);
  await page.locator('.medicine-card').click();
  assert.equal(await page.locator('#medicine-detail-title').innerText(), 'Clopidogrel');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'medicine-detail-title');
  assert.match(await page.locator('#medicine-detail-body').innerText(), /CYP2C19|Not interpreted/);
  await page.locator('.topic-add-button').click();
  assert.equal(await page.locator('.topic-add-button').isDisabled(), true);
  assert.equal(await page.locator('#results').isHidden(), true);

  for (const topic of ['statins', 'thiopurines', 'fluoropyrimidines', 'opioids']) {
    await page.locator('#medicine-search').fill('');
    await page.locator(`[data-topic="${topic}"]`).click();
    await page.locator('.topic-add-button').click();
  }
  assert.equal(await page.locator('#question-count').innerText(), '5 of 5 questions');
  await page.locator('#medicine-search').fill('');
  await page.locator('[data-topic="warfarin"]').click();
  await page.locator('.topic-add-button').click();
  assert.match(await page.locator('#question-status').innerText(), /five questions|5 questions/i);
  assert.equal(await page.locator('.question-item').count(), 5);

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#question-export').click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), 'genemachine-appointment-questions.html');
  const report = await fs.readFile(await download.path(), 'utf8');
  assert.match(report, /not a personal medical assessment/);
  assert.match(report, /pending DPYD guideline update/);
  assert.doesNotMatch(report, /rs4149056|<script|<img/);
  const reportPage = await context.newPage();
  await reportPage.setContent(report);
  assert.equal(await reportPage.locator('section[aria-label="Appointment questions"] article').count(), 5);
  for (const width of [320, 390, 1280]) {
    await reportPage.setViewportSize({ width, height: 900 });
    assert.equal(await reportPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `checklist reflow ${width}`);
  }
  await reportPage.emulateMedia({ media: 'print' });
  assert.equal(await reportPage.locator('section[aria-label="Appointment questions"] article').count(), 5);
  await reportPage.close();
  await page.locator('#question-clear').click();
  assert.equal(await page.locator('#question-export').isDisabled(), true);
  await page.locator('#medicine-search').fill('<img src=x onerror=alert(1)>');
  assert.equal(await page.locator('.medicine-card').count(), 0);
  assert.equal(await page.locator('#library-empty').isVisible(), true);
  await page.locator('#medicine-search').fill('');
  await page.locator('[data-topic="statins"]').click();
  await page.locator('.topic-add-button').click();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#medicine-detail').isHidden(), true);
  await page.locator('#question-clear').click();

  await page.locator('#consent-checkbox').check();
  const fixture = await fs.readFile(path.join(root, 'samples/synthetic-ancestry.txt'));
  await page.locator('#file-input').setInputFiles({ name: 'private-person.txt', mimeType: 'text/plain', buffer: fixture });
  await page.locator('#results:not([hidden])').waitFor();
  assert.equal((await page.locator('#finding-badge').innerText()).trim(), 'OBSERVATION SUPPORTED');
  assert.equal(await page.locator('#evidence-details').evaluate(element => element.open), false);
  assert.equal(await page.locator('#result-details').evaluate(element => element.open), false);
  await page.locator('#result-details > summary').click();

  const expectedHash = createHash('sha256').update(fixture).digest('hex');
  assert.equal((await page.locator('#provenance-hash').innerText()).trim(), `${expectedHash.slice(0, 16)}...`);
  const dnaDownloadPromise = page.waitForEvent('download');
  await page.locator('#export-button').click();
  const dnaDownload = await dnaDownloadPromise;
  assert.equal(dnaDownload.suggestedFilename(), 'genemachine-discussion-report.html');
  const dnaReport = await fs.readFile(await dnaDownload.path(), 'utf8');
  assert.ok(dnaReport.includes(expectedHash), 'DNA report preserves the original-byte digest');
  assert.doesNotMatch(dnaReport, /private-person\.txt/);
  assert.doesNotMatch(await page.locator('body').innerText(), /private-person\.txt/);
  await page.locator('#consent-checkbox').uncheck();
  assert.equal(await page.locator('#results').isHidden(), true);
  assert.equal(await page.locator('#evidence-ladder').innerText(), '');
  assert.equal(await page.locator('#file-input').inputValue(), '');

  // Delaying the local fixture request exposes stale demo completion after cancel.
  await page.route('**/samples/synthetic-ancestry.txt', async route => {
    await new Promise(resolve => setTimeout(resolve, 150));
    await route.fulfill({ status: 200, body: fixture, contentType: 'text/plain' }).catch(() => {});
  });
  await page.locator('#demo-button').click();
  await page.locator('#cancel-button').click();
  await page.waitForTimeout(200);
  assert.equal(await page.locator('#results').isHidden(), true);
  await page.unroute('**/samples/synthetic-ancestry.txt');

  // A 500k-row synthetic file exercises responsiveness and a real worker termination.
  const large = Buffer.from('# build 37\n# forward strand\nrsid\tchromosome\tposition\tgenotype\n' + Array.from({ length: 500000 }, (_, i) => `rs${i + 1000000}\t1\t${i + 1}\tAA`).join('\n'));
  await page.locator('#consent-checkbox').check();
  await page.locator('#file-input').setInputFiles({ name: 'large-synthetic.txt', mimeType: 'text/plain', buffer: large });
  await page.locator('#cancel-button').click();
  assert.equal(await page.locator('#results').isHidden(), true);
  await page.waitForTimeout(150);
  assert.equal(await page.locator('#results').isHidden(), true);
  await page.locator('#demo-button').click();
  await page.locator('#results:not([hidden])').waitFor();
  assert.match(await page.locator('#synthetic-badge').innerText(), /EXAMPLE, NOT YOUR DNA/);
  assert.equal((await page.locator('#finding-badge').innerText()).trim(), 'OBSERVATION SUPPORTED');

  const layouts = [];
  for (const width of [320, 390, 720, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const dimensions = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    assert.equal(dimensions.width, dimensions.scrollWidth, `${engine.name()} overflow at ${width}`);
    layouts.push(dimensions);
  }
  await page.setViewportSize({ width: 720, height: 900 });
  await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, '200% zoom reflow');
  await page.evaluate(() => { document.documentElement.style.zoom = '1'; });

  assert.equal(await page.evaluate(async () => localStorage.length + sessionStorage.length + (await indexedDB.databases()).length), 0);
  assert.ok(requests.every(request => request.method === 'GET' && new URL(request.url).origin === url));
  assert.deepEqual(errors, []);
  for (const privatePath of ['/.git/config', '/README.md', '/evidence/2026-10-02/cursor-design.jsonl']) {
    assert.equal((await page.request.get(url + privatePath)).status(), 404);
  }
  const response = await page.request.get(url + '/web/');
  assert.match(response.headers()['content-security-policy'], /connect-src 'self'/);
  assert.match(response.headers()['content-security-policy'], /worker-src 'self'/);
  assert.match(response.headers()['content-security-policy'], /frame-ancestors 'none'/);
  assert.equal(response.headers()['referrer-policy'], 'no-referrer');
  assert.equal(response.headers()['x-content-type-options'], 'nosniff');
  assert.equal(response.headers()['cache-control'], 'no-store');
  assert.equal((await page.request.post(url + '/web/', { data: 'no-upload' })).status(), 405);
  await page.locator('#reset-button').click();
  assert.equal(await page.locator('#results').isHidden(), true);
  return { engine: engine.name(), topics: 9, checklistLimit: 5, workerCancel: 'passed', consentRevocation: 'passed', sameOriginGetOnly: true, layouts, errors };
  } finally { await browser.close(); }
}

(async () => {
  let child, url;
  if (process.env.GENEMACHINE_TEST_ORIGIN) {
    const target = new URL(process.env.GENEMACHINE_TEST_ORIGIN);
    assert.ok(target.protocol === 'https:' && target.pathname === '/' && !target.search && !target.hash && !target.username && !target.password, 'Set GENEMACHINE_TEST_ORIGIN to an HTTPS origin without credentials, query, or path');
    url = target.origin;
  } else {
    ({ child, url } = await startServer());
  }
  try {
    const results = [];
    for (const engine of [chromium, webkit].filter(type => !process.env.GENEMACHINE_ENGINES || process.env.GENEMACHINE_ENGINES.split(",").includes(type.name()))) results.push(await verify(engine, url));
    console.log(JSON.stringify(results, null, 2));
  } finally { child?.kill(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
