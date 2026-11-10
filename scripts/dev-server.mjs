// Serves build/web plus report zips from .fixtures/ for the local harness.
//   http://localhost:5173/host.html  → viewer inside a cross-origin sandboxed iframe (like Azure DevOps)
//   http://localhost:5173/dev.html   → viewer as a top-level page
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const web = path.join(root, 'build', 'web');
const fixtures = path.join(root, '.fixtures');
const port = Number(process.env.PORT) || 5173;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.zip': 'application/zip', '.png': 'image/png' };

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/fixtures/') {
      const names = fs.existsSync(fixtures) ? fs.readdirSync(fixtures).filter((n) => n.endsWith('.zip')).sort() : [];
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(names));
      return;
    }
    const [base, rel] = url.pathname.startsWith('/fixtures/')
      ? [fixtures, decodeURIComponent(url.pathname.slice('/fixtures/'.length))]
      : [web, url.pathname === '/' ? 'host.html' : decodeURIComponent(url.pathname.slice(1))];
    const file = path.join(base, rel);
    if (!file.startsWith(base + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end('Not found');
      return;
    }
    const stat = fs.statSync(file);
    res.writeHead(200, {
      'content-type': types[path.extname(file)] ?? 'application/octet-stream',
      'content-length': stat.size,
      'cache-control': 'no-store',
    });
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, () => console.log(`Dev harness: http://localhost:${port}/host.html`));
