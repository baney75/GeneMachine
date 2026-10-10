import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ORIGIN = 'https://genemachine.magnus-b37.workers.dev';
const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

function metaTags(html) {
  return [...html.matchAll(/<meta\s+([^>]+?)\/?>/g)].map(([, attrs]) =>
    Object.fromEntries([...attrs.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value])));
}
const metaContent = (tags, key) => tags.find(tag => tag.name === key || tag.property === key)?.content;

test('the app page declares a canonical URL, social preview and valid structured data', async () => {
  const html = await read('web/index.html');
  const tags = metaTags(html);
  assert.match(html, new RegExp(`<link rel="canonical" href="${ORIGIN}/web/">`));
  assert.equal(metaContent(tags, 'og:url'), `${ORIGIN}/web/`);
  assert.equal(metaContent(tags, 'og:image'), `${ORIGIN}/assets/social-preview.png`);
  assert.equal(metaContent(tags, 'twitter:card'), 'summary_large_image');
  const description = metaContent(tags, 'description');
  assert.ok(description.length >= 70 && description.length <= 200, `description is ${description.length} characters`);
  const title = html.match(/<title>([^<]+)<\/title>/)[1];
  assert.ok(title.length <= 65, `title is ${title.length} characters`);
  const graph = JSON.parse(html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)[1])['@graph'];
  assert.deepEqual(graph.map(item => item['@type']), ['WebApplication', 'SoftwareSourceCode', 'MedicalWebPage']);
  const app = graph.find(item => item['@type'] === 'WebApplication');
  assert.equal(app.isAccessibleForFree, true);
  assert.equal(app.codeRepository, undefined, 'codeRepository belongs on SoftwareSourceCode, not WebApplication');
  assert.equal(graph.find(item => item['@type'] === 'SoftwareSourceCode').codeRepository, 'https://github.com/baney75/GeneMachine');
});

test('the build publishes robots.txt, a clean-URL sitemap and the social image', async () => {
  execFileSync(process.execPath, [fileURLToPath(new URL('scripts/build.mjs', root))], { cwd: fileURLToPath(root), stdio: 'ignore' });
  const robots = await read('dist/robots.txt');
  assert.match(robots, new RegExp(`Sitemap: ${ORIGIN}/sitemap.xml`));
  assert.doesNotMatch(robots, /Disallow: \/(web|lib|assets)\//);
  const urls = [...(await read('dist/sitemap.xml')).matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  assert.ok(urls.includes(`${ORIGIN}/web/`));
  for (const url of urls) {
    assert.ok(url.startsWith(`${ORIGIN}/`), url);
    assert.doesNotMatch(url, /\.html$/, `${url} redirects under auto-trailing-slash`);
  }
  const image = new URL(metaContent(metaTags(await read('web/index.html')), 'og:image'));
  assert.ok((await stat(new URL(`dist${image.pathname}`, root))).size > 0, `dist${image.pathname} exists`);
});
