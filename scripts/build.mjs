import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const dist = new URL('dist/', root);
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const folder of ['web', 'lib', 'assets']) await cp(new URL(`${folder}/`, root), new URL(`${folder}/`, dist), { recursive: true });
await mkdir(new URL('samples/', dist));
await cp(new URL('samples/synthetic-ancestry.txt', root), new URL('samples/synthetic-ancestry.txt', dist));
await mkdir(new URL('docs/', dist));
await cp(new URL('docs/product-evaluation.html', root), new URL('docs/product-evaluation.html', dist));
for (const file of ['_headers', '_redirects', 'robots.txt', 'sitemap.xml']) await cp(new URL(`hosting/${file}`, root), new URL(file, dist));
await writeFile(new URL('index.html', dist), '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=./web/"><title>GeneMachine</title></head><body><a href="./web/">Open GeneMachine</a></body></html>\n');
console.log(`Static GeneMachine built at ${fileURLToPath(dist)}. Only public app assets and the synthetic example are included.`);
