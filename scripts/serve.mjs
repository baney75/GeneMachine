import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const port = Number(process.env.GENEMACHINE_PORT || 4173);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8' };
const headers = {
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; worker-src 'self'; connect-src 'self'; img-src 'self'; style-src 'self' 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'no-store',
};
const server = createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, headers); response.end('Method not allowed'); return; }
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/') { response.writeHead(302, { ...headers, Location: './web/' }); response.end(); return; }
    const publicPath = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
    const allowed = /^\/(web|lib|assets)\/[^/]+\.(html|css|js|mjs|svg)$/.test(publicPath) || publicPath === '/samples/synthetic-ancestry.txt' || publicPath === '/docs/product-evaluation.html';
    const target = resolve(root, `.${publicPath}`);
    if (!allowed || !target.startsWith(`${root}${sep}`)) throw new Error('Unavailable');
    const body = await readFile(target);
    response.writeHead(200, { ...headers, 'Content-Type': mime[extname(target)] });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch { response.writeHead(404, headers); response.end('Not found'); }
});
server.listen(port, '127.0.0.1', () => { console.log(`GeneMachine: http://127.0.0.1:${server.address().port}/web/`); });
server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? `Port ${port} is busy. Set GENEMACHINE_PORT to a free port.` : 'Could not start the local server.'); process.exitCode = 1; });
