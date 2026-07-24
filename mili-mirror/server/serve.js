#!/usr/bin/env node
// LocalRuntimeEngineer output (A-009): local server compatible with the serving contract.
// Serves captured routes and assets with correct MIME types, HEAD and byte ranges (206).
//
// Usage: node server/serve.js --contract capture/serving-contract.json [--root <dir>] [--port 4173] [--host 127.0.0.1]
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from '../scripts/lib/config.js';
import { mimeForPath } from '../scripts/lib/mime.js';

export function createMirrorServer({ contractPath, root, host = '127.0.0.1', port = 4173, missingLog = null }) {
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  const rootDir = path.resolve(root || path.dirname(path.dirname(contractPath)));
  const routeMap = new Map(contract.routes.map((r) => [r.requestPath, r.file]));
  const assetMap = new Map(Object.entries(contract.assets || {}));

  const resolveLocal = (relFile) => {
    const abs = path.resolve(rootDir, relFile);
    if (!abs.startsWith(rootDir + path.sep) && abs !== rootDir) return null; // path traversal guard
    return abs;
  };

  const logMissing = (requestPath) => {
    if (!missingLog) return;
    fs.mkdirSync(path.dirname(missingLog), { recursive: true });
    fs.appendFileSync(missingLog, `${new Date().toISOString()} ${requestPath}\n`, 'utf8');
  };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      res.writeHead(400).end('Bad Request');
      return;
    }
    if (pathname.includes('..')) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    let relFile = routeMap.get(pathname) || null;
    if (!relFile) {
      // Assets are matched by pathname; query strings are ignored (see contract notes)
      relFile = assetMap.get(pathname) || null;
    }
    if (!relFile && pathname.startsWith('/__ext/')) {
      relFile = assetMap.get(pathname) || null;
    }
    if (!relFile) {
      logMissing(pathname);
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not Found');
      return;
    }

    const abs = resolveLocal(relFile);
    if (!abs || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
      logMissing(pathname);
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not Found');
      return;
    }

    const size = fs.statSync(abs).size;
    const contentType = mimeForPath(abs);
    const baseHeaders = {
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    };

    const rangeHeader = req.headers.range;
    const rangeMatch = rangeHeader ? /^bytes=(\d*)-(\d*)$/.exec(rangeHeader) : null;

    if (rangeMatch && (rangeMatch[1] !== '' || rangeMatch[2] !== '')) {
      let start = rangeMatch[1] === '' ? null : Number(rangeMatch[1]);
      let end = rangeMatch[2] === '' ? null : Number(rangeMatch[2]);
      if (start === null) {
        start = Math.max(0, size - end);
        end = size - 1;
      } else {
        end = end === null ? size - 1 : Math.min(end, size - 1);
      }
      if (start > end || start >= size) {
        res.writeHead(416, { ...baseHeaders, 'Content-Range': `bytes */${size}` }).end();
        return;
      }
      res.writeHead(206, {
        ...baseHeaders,
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Content-Length': end - start + 1,
      });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      fs.createReadStream(abs, { start, end }).pipe(res);
      return;
    }

    res.writeHead(200, { ...baseHeaders, 'Content-Length': size });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    fs.createReadStream(abs).pipe(res);
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve({ server, contract, address: server.address() }));
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = parseArgs(process.argv);
  const contractPath = path.resolve(args.contract || 'capture/serving-contract.json');
  createMirrorServer({
    contractPath,
    root: args.root ? path.resolve(args.root) : path.dirname(path.dirname(contractPath)),
    host: args.host || '127.0.0.1',
    port: Number(args.port || 4173),
    missingLog: path.join(path.dirname(contractPath), 'logs', 'server-missing.log'),
  })
    .then(({ address }) => {
      console.log(`[SERVE] Servidor local em http://${address.address}:${address.port}`);
      console.log('[SERVE] spaFallback desativado: 404 real para arquivos ausentes. Ctrl+C para parar.');
    })
    .catch((err) => {
      console.error(`[SERVE] Falha ao iniciar: ${err.message}`);
      process.exit(1);
    });
}
