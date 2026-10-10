const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium, webkit } = require('playwright');

async function startServer() {
  const child = spawn(process.execPath, ['scripts/serve.mjs'], {
    cwd: path.resolve(__dirname, '..'), env: { ...process.env, GENEMACHINE_PORT: '0' },
  });
  const url = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', code => reject(new Error(`Server exited ${code}`)));
    child.stdout.on('data', data => {
      const match = String(data).match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) resolve(match[0]);
    });
  });
  return { child, url };
}

async function check(engine, origin) {
  const browser = await engine.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const requests = [], errors = [];
    page.on('request', request => requests.push({ url: request.url(), method: request.method() }));
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin);
    await page.locator('.medicine-card').first().waitFor();
    assert.equal(await page.locator('#question-editor').isHidden(), true);
    assert.equal(await page.locator('#question-copy').isDisabled(), true);

    // A medicine absent from the library still has a useful, unassessed path.
    await page.locator('#medicine-search').fill('Unlisted synthetic medicine');
    assert.equal(await page.locator('.medicine-card').count(), 0);
    await page.locator('#library-write-question').click();
    assert.equal(await page.locator('#entry-medicine').inputValue(), 'Unlisted synthetic medicine');
    assert.equal(await page.locator('#question-export').isDisabled(), true);
    assert.equal(await page.locator('#question-copy').isDisabled(), true);
    const customQuestion = 'What should I ask my pharmacist about this medicine?';
    const customNotes = 'Synthetic note, line one.\n<img src=x onerror="window.injected=true">';
    await page.locator('#entry-question').fill(' ');
    await page.locator('#entry-save').click();
    assert.equal(await page.locator('.question-item').count(), 0);
    assert.match(await page.locator('#entry-error').innerText(), /Enter a question/);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'entry-question');
    await page.locator('#entry-question').fill('x'.repeat(601));
    await page.locator('#entry-save').click();
    assert.equal(await page.locator('.question-item').count(), 0);
    assert.match(await page.locator('#entry-error').innerText(), /600/);
    assert.equal((await page.locator('#entry-question').inputValue()).length, 601, 'Invalid text stays available to correct');
    await page.locator('#entry-question').fill(customQuestion);
    await page.locator('#entry-notes-toggle').click();
    await page.locator('#entry-notes').fill(customNotes);
    await page.locator('#entry-save').click();
    assert.equal(await page.locator('#question-editor').isHidden(), true);
    assert.equal(await page.locator('.question-item').count(), 1);
    assert.match(await page.locator('.question-item').innerText(), /Medicine not assessed/i);
    assert.doesNotMatch(await page.locator('.question-item').innerText(), /CYP|SLCO|CPIC/);
    assert.equal(await page.locator('#results').isHidden(), true);
    assert.equal(await page.locator('#consent-checkbox').isChecked(), false);

    // Curated evidence retains its identity while the person's question changes.
    await page.locator('#medicine-search').fill('statins');
    await page.locator('[data-topic="statins"]').click();
    await page.locator('.topic-add-button').click();
    assert.equal(await page.locator('.question-item').count(), 2);
    await page.locator('.question-item').nth(1).locator('.question-edit').click();
    const personalQuestion = 'How would a clinical result fit with my other medicines?';
    await page.locator('#entry-question').fill(personalQuestion);
    await page.locator('#entry-notes-toggle').click();
    await page.locator('#entry-notes').fill('Bring my current medicine list.');
    await page.locator('#entry-save').click();
    assert.match(await page.locator('.question-item').nth(1).innerText(), /Your question/i);
    await page.locator('.question-item').nth(1).locator('.question-up').click();
    assert.match(await page.locator('.question-item').first().innerText(), /Statins/);
    assert.match(await page.locator('.question-item').first().innerText(), /How would a clinical result/);

    const downloadPromise = page.waitForEvent('download');
    await page.locator('#question-export').click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), 'genemachine-appointment-questions.html');
    const html = await fs.readFile(await download.path(), 'utf8');
    assert.ok(html.includes(personalQuestion) && html.includes(customQuestion));
    assert.ok(html.includes('&lt;img src=x onerror='));
    assert.doesNotMatch(html, /<script|<img/);
    assert.match(html, /Medicine not assessed/);
    assert.match(html, /publication\/statins\/2022/);
    assert.match(html, /consumer-array marker does not establish/);
    const reportPage = await context.newPage();
    await reportPage.setContent(html);
    assert.equal(await reportPage.locator('img').count(), 0);
    assert.equal(await reportPage.evaluate(() => window.injected), undefined);
    assert.match(await reportPage.locator('body').innerText(), /Synthetic note, line one/);
    for (const width of [320, 390, 1280]) {
      await reportPage.setViewportSize({ width, height: 900 });
      assert.equal(await reportPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `report overflow ${width}`);
    }
    await reportPage.emulateMedia({ media: 'print' });
    assert.equal(await reportPage.getByText(personalQuestion, { exact: true }).isVisible(), true);
    await reportPage.close();

    // Exercise the real Chromium clipboard, then the explicit denial recovery.
    let clipboard = 'denial fallback';
    if (engine.name() === 'chromium') {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.locator('#question-copy').click();
      const copied = await page.evaluate(() => navigator.clipboard.readText());
      assert.ok(copied.includes(personalQuestion) && copied.includes(customNotes));
      assert.match(copied, /Medicine not assessed/);
      clipboard = 'native write/read and denial fallback';
    }
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
      configurable: true, value: { writeText: () => Promise.reject(new DOMException('Denied', 'NotAllowedError')) },
    }));
    await page.locator('#question-copy').click();
    await page.locator('#copy-fallback').waitFor({ state: 'visible' });
    const fallback = await page.locator('#copy-text').inputValue();
    assert.ok(fallback.includes(personalQuestion) && fallback.includes(customNotes));
    assert.match(fallback, /not a personal medical assessment/);

    // Drafts cannot silently replace saved questions or escape export validation.
    await page.locator('.question-item').first().locator('.question-edit').click();
    await page.locator('#entry-question').fill('Unsaved synthetic change');
    assert.equal(await page.locator('#question-export').isDisabled(), true);
    assert.equal(await page.locator('#question-copy').isDisabled(), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#question-editor').isHidden(), true);
    assert.match(await page.locator('.question-item').first().innerText(), /How would a clinical result/);
    assert.doesNotMatch(await page.locator('.question-item').first().innerText(), /Unsaved synthetic/);

    // Custom and curated questions share the same five-item limit.
    for (const name of ['Synthetic second', 'Synthetic third', 'Synthetic fourth']) {
      await page.locator('#question-new').click();
      await page.locator('#entry-medicine').fill(name);
      await page.locator('#entry-save').click();
    }
    assert.equal(await page.locator('.question-item').count(), 5);
    assert.match(await page.locator('#question-count').innerText(), /5 of 5 questions/);
    await page.locator('#medicine-search').fill('warfarin');
    await page.locator('[data-topic="warfarin"]').click();
    const add = page.locator('.topic-add-button');
    if (!(await add.isDisabled())) await add.click();
    assert.equal(await page.locator('.question-item').count(), 5);
    await page.locator('.question-item').last().locator('.question-remove').click();
    await page.locator('.topic-add-button').click();
    assert.equal(await page.locator('.question-item').count(), 5);

    // Long user text and the editor reflow; reset removes saved and unsaved writing.
    await page.locator('.question-item').first().locator('.question-edit').click();
    await page.locator('#entry-notes').fill('x'.repeat(1200));
    for (const width of [320, 390, 720, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `editor overflow ${width}`);
      for (const id of ['entry-question', 'entry-notes', 'entry-save', 'entry-cancel']) {
        const box = await page.locator(`#${id}`).boundingBox();
        assert.ok(box.width > 0 && box.x >= 0 && box.x + box.width <= width + 1, `${id} clipped at ${width}`);
      }
    }
    await page.locator('#question-clear').click();
    assert.equal(await page.locator('.question-item').count(), 0);
    assert.equal(await page.locator('#question-editor').isHidden(), true);
    assert.equal(await page.locator('#entry-question').inputValue(), '');
    assert.equal(await page.locator('#entry-notes').inputValue(), '');
    assert.equal(await page.locator('#copy-text').inputValue(), '');
    assert.equal(await page.locator('#copy-fallback').isHidden(), true);
    assert.equal(await page.locator('.medicine-added').count(), 0);

    await page.locator('#question-new').click();
    await page.locator('#entry-medicine').fill('Never persisted');
    await page.locator('#entry-notes-toggle').click();
    await page.locator('#entry-notes').fill('Private draft sentinel');
    await page.reload();
    await page.locator('.medicine-card').first().waitFor();
    assert.equal(await page.locator('.question-item').count(), 0);
    assert.equal(await page.locator('#entry-notes').inputValue(), '');

    // A late clipboard rejection must not restore cleared private writing.
    await page.locator('#question-new').click();
    await page.locator('#entry-medicine').fill('Delayed clipboard sentinel');
    await page.locator('#entry-save').click();
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
      configurable: true, value: { writeText: () => new Promise((resolve, reject) => { window.rejectPendingCopy = reject; }) },
    }));
    await page.locator('#question-copy').click();
    await page.locator('#question-clear').click();
    await page.evaluate(async () => { window.rejectPendingCopy(new Error('Delayed denial')); await Promise.resolve(); });
    assert.equal(await page.locator('#copy-text').inputValue(), '');
    assert.equal(await page.locator('#copy-fallback').isHidden(), true);
    assert.doesNotMatch(await page.locator('#question-status').innerText(), /Delayed clipboard sentinel|blocked copying/);
    assert.equal(await page.evaluate(async () => localStorage.length + sessionStorage.length + (await indexedDB.databases()).length), 0);
    assert.equal((await context.cookies()).length, 0);
    assert.ok(requests.every(request => request.method === 'GET' && new URL(request.url).origin === origin));
    assert.deepEqual(errors, []);
    return { engine: engine.name(), customAndEditedQuestions: 'passed', ordering: 'passed', limit: 5, clipboard, exportAndReset: 'passed', privateState: 'memory only', widths: [320, 390, 720, 1440] };
  } finally { await browser.close(); }
}

(async () => {
  let child, url;
  if (process.env.GENEMACHINE_TEST_ORIGIN) {
    const target = new URL(process.env.GENEMACHINE_TEST_ORIGIN);
    assert.ok(target.protocol === 'https:' && target.pathname === '/' && !target.search && !target.hash && !target.username && !target.password);
    url = target.origin;
  } else ({ child, url } = await startServer());
  try {
    const results = [];
    for (const engine of [chromium, webkit].filter(type => !process.env.GENEMACHINE_ENGINES || process.env.GENEMACHINE_ENGINES.split(",").includes(type.name()))) results.push(await check(engine, url));
    console.log(JSON.stringify(results, null, 2));
  } finally { child?.kill(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
