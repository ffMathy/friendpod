#!/usr/bin/env node
/**
 * Serves a preview build (single-page web export) on localhost: files as they are, every other path falls back to
 * index.html so deep links such as /pod/<podId>/plan reach expo-router.
 *
 *   node preview/serve.mjs --build-dir <dir> [--port 8090]
 */
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.map': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

/** Starts the server; resolves with `{ url, close }`. Port 0 picks a free port. */
export function serve(buildDir, port = 0) {
  const root = path.resolve(buildDir);
  const server = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
    let file = path.join(root, pathname);
    if (!file.startsWith(root)) {
      res.writeHead(403).end();
      return;
    }
    let stat;
    try {
      stat = statSync(file);
    } catch {
      stat = undefined;
    }
    if (!stat || stat.isDirectory()) {
      file = path.join(root, 'index.html');
      stat = statSync(file);
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': 'no-store',
    });
    createReadStream(file).pipe(res);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      resolve({
        url: `http://127.0.0.1:${typeof address === 'object' && address ? address.port : port}`,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const get = (name, fallback) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : fallback;
  };
  const buildDir = get('--build-dir', null);
  if (!buildDir) {
    console.error('usage: node preview/serve.mjs --build-dir <dir> [--port 8090]');
    process.exit(2);
  }
  const { url } = await serve(buildDir, Number(get('--port', '8090')));
  console.log(`preview served at ${url}  (e.g. ${url}/?scenario=signed-out&locale=da)`);
}
