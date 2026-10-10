import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ORIGIN = 'https://genemachine.magnus-b37.workers.dev';
const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('the app page declares a canonical URL, social preview and valid structured data', async () => {
  const html = await read('web/index.html');
  const meta = (attr, key) => html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]+)"`))?.[1];
  assert.match(html, new RegExp(`<link rel="canonical" href="${ORIGIN}/web/">`));
  assert.equal(meta('property', 'og:url'), `${ORIGIN}/web/`);
  assert.equal(meta('property', 'og:image'), `${ORIGIN}/assets/social-preview.png`);
  assert.equal(meta('name', 'twitter:card'), 'summary_large_image');
  const description = meta('name', 'description');
  assert.ok(description.length >= 70 && description.length <= 200, `description is ${description.length} characters`);
  const title = html.match(/<title>([^<]+)<\/title>/)[1];
  assert.ok(title.length <= 65, `title is ${title.length} characters`);
  const data = JSON.parse(html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)[1]);
  const types = data['@graph'].map(item => item['@type']);
  assert.deepEqual(types, ['WebApplication', 'MedicalWebPage']);
  assert.equal(data['@graph'][0].isAccessibleForFree, true);
});

test('robots.txt points at a sitemap that lists only public pages on the canonical origin', async () => {
  const robots = await read('hosting/robots.txt');
  assert.match(robots, new RegExp(`Sitemap: ${ORIGIN}/sitemap.xml`));
  assert.doesNotMatch(robots, /Disallow: \/(web|lib|assets)\//);
  const sitemap = await read('hosting/sitemap.xml');
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  assert.ok(urls.includes(`${ORIGIN}/web/`));
  for (const url of urls) assert.ok(url.startsWith(`${ORIGIN}/`));
  assert.match(await read('scripts/build.mjs'), /'robots\.txt', 'sitemap\.xml'/);
});
