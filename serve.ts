// SOLANO HEAT — local test server.
//
// Serves this repository's root on http://localhost:8080 so the game can be
// played and screenshotted locally:
//
//   node serve.ts            then open http://localhost:8080/game/
//
// It also accepts the screenshot hand-back the shot staging uses: a staged
// page POSTs its canvas as a JPEG to /__save/<name>.jpg and the bytes are
// written into screenshots/ beside this file. Nothing here is part of the
// handed-in entry; main.ts is the entrypoint.

import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const shotsDir = join(root, 'screenshots');
const port = 8080;

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ts': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`);

  // Screenshot hand-back: POST /__save/1-start.jpg with the JPEG as the body.
  if (req.method === 'POST' && url.pathname.startsWith('/__save/')) {
    const name = url.pathname.slice('/__save/'.length);
    if (!/^[0-9a-z-]+\.jpg$/.test(name)) {
      res.writeHead(400).end('bad screenshot name');
      return;
    }
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      writeFileSync(join(shotsDir, name), body);
      console.log(`saved screenshots/${name} (${body.length} bytes)`);
      res.writeHead(200, { 'content-type': 'text/plain' }).end('saved');
    });
    return;
  }

  if (req.method !== 'GET') {
    res.writeHead(405).end('method not allowed');
    return;
  }

  let path = normalize(decodeURIComponent(url.pathname)).replace(/^[/\\]+/, '');
  if (path === '' || path === '.') path = 'game/index.html';
  const full = join(root, path);
  if (!full.startsWith(root) || !existsSync(full) || !statSync(full).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
    return;
  }
  res.writeHead(200, {
    'content-type': MIME[extname(full).toLowerCase()] ?? 'application/octet-stream',
    'cache-control': 'no-store',
  });
  res.end(readFileSync(full));
});

server.listen(port, () => {
  console.log(`solano-heat: serving ${root} at http://localhost:${port}/ (game at /game/)`);
});
