const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { chromium, webkit } = require('playwright');

async function localServer() {
  const child = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: path.resolve(__dirname, '..'), env: { ...process.env, GENEMACHINE_PORT: '0' } });
  const url = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', code => reject(new Error(`Server exited ${code}`)));
    child.stdout.on('data', data => { const match = String(data).match(/http:\/\/127\.0\.0\.1:\d+/); if (match) resolve(match[0]); });
  });
  return { child, url };
}

function measure(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const texts = [];
  for (let item = walker.nextNode(); item; item = walker.nextNode()) {
    if (item.parentElement.closest('script,style,noscript,[hidden]')) continue;
    let collapsed = false;
    for (let ancestor = item.parentElement; ancestor; ancestor = ancestor.parentElement) {
      if (ancestor.tagName === 'DETAILS' && !ancestor.open) {
        const summary = [...ancestor.children].find(child => child.tagName === 'SUMMARY');
        if (!summary?.contains(item)) { collapsed = true; break; }
      }
    }
    if (collapsed) continue;
    const range = document.createRange();
    range.selectNodeContents(item);
    if ([...range.getClientRects()].some(rect => rect.width > 0 && rect.height > 0)) texts.push(item.textContent.trim());
  }
  return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, words: texts.join(' ').trim().split(/\s+/).length, text: texts.join(' ') };
}

async function check(engine, origin) {
  const browser = await engine.launch({ headless: true });
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    await page.goto(origin);
    await page.locator('.medicine-card').first().waitFor();
    assert.equal(await page.locator('.medicine-card').count(), 7);
    assert.equal(await page.locator('#medicine-detail').isHidden(), true);
    assert.equal(await page.locator('#results').isHidden(), true);
    const layouts = [];
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      const metrics = await page.locator('body').evaluate(measure);
      assert.ok(metrics.words <= 220, `Default page has ${metrics.words} rendered words at ${width}px; limit is 220`);
      assert.equal(metrics.scrollWidth, metrics.width, `Overflow at ${width}px`);
      assert.match(metrics.text, /Educational/i);
      layouts.push({ width, words: metrics.words, height: metrics.height });
    }
    assert.equal(await page.locator('.schematic').count(), 0, 'Explanatory hero diagram is removed');
    for (const anchor of await page.locator('a[href^="#"]').evaluateAll(items => items.map(item => item.getAttribute('href')))) {
      if (anchor.length > 1) assert.ok(await page.locator(anchor).count(), `Missing anchor target ${anchor}`);
    }
    await page.locator('[data-topic="statins"]').click();
    const topic = await page.locator('#medicine-detail').evaluate(measure);
    assert.ok(topic.words <= 130, `Selected topic has ${topic.words} rendered words`);
    assert.equal(await page.locator('#medicine-detail-body details').evaluate(element => element.open), false);
    assert.equal(await page.locator('.topic-add-button').isVisible(), true);
    assert.equal(await page.locator('#medicine-detail-body .topic-source').first().isVisible(), true);
    await page.locator('#medicine-detail-body summary').click();
    assert.ok((await page.locator('#medicine-detail').evaluate(measure)).words > topic.words, 'Evidence disclosure reveals the full context');
    await page.keyboard.press('Escape');
    await page.locator('#demo-button').click();
    await page.locator('#results:not([hidden])').waitFor();
    const result = await page.locator('#results').evaluate(measure);
    assert.ok(result.words <= 180, `Primary DNA result has ${result.words} rendered words`);
    assert.match(result.text, /not clinically validated/);
    assert.equal(await page.locator('#finding-badge').isVisible(), true);
    for (const [id, content] of [['evidence-details', 'evidence-ladder'], ['result-details', 'metric-grid']]) {
      const disclosure = page.locator(`#${id}`);
      assert.equal(await disclosure.evaluate(element => element.open), false);
      assert.equal(await page.locator(`#${content}`).isVisible(), false);
      await disclosure.locator('summary').first().click();
      assert.equal(await page.locator(`#${content}`).isVisible(), true);
    }
    return { engine: engine.name(), layouts, topicWords: topic.words, resultWords: result.words };
  } finally { await browser.close(); }
}

(async () => {
  let child, url;
  if (process.env.GENEMACHINE_TEST_ORIGIN) {
    const target = new URL(process.env.GENEMACHINE_TEST_ORIGIN);
    assert.ok(target.protocol === 'https:' && target.pathname === '/' && !target.search && !target.hash && !target.username && !target.password);
    url = target.origin;
  } else ({ child, url } = await localServer());
  try {
    const results = [];
    for (const engine of [chromium, webkit]) results.push(await check(engine, url));
    console.log(JSON.stringify(results, null, 2));
  } finally { child?.kill(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
