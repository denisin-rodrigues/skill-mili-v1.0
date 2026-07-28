#!/usr/bin/env node
// LocalRuntimeEngineer output (A-009): local server compatible with the serving contract v2.
// Query-aware: pathname + exact query string distinguish assets. No generic fallback:
// undeclared queries on query-sensitive paths return a real 404.
// Path safety: raw traversal is rejected BEFORE any URL normalization (V-01), and all
// filesystem resolution goes through the central safe-path module.
//
// Usage: node server/serve.js --contract capture/serving-contract.json [--root <dir>] [--port 4173] [--host 127.0.0.1]
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from '../scripts/lib/config.js';
import { mimeForPath } from '../scripts/lib/mime.js';
import { resolveHttpPathname, resolveWithin } from '../scripts/lib/safe-path.js';
import { validateServingContract, formatValidationErrors } from '../validators/index.js';
import { EXIT, failWith } from '../scripts/lib/exit-codes.js';

const ASSETS_PREFIX = '/__assets/';

export function createMirrorServer({ contractPath, root, host = '127.0.0.1', port = 4173, missingLog = null }) {
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  const contractCheck = validateServingContract(contract);
  if (!contractCheck.valid) {
    throw new Error(formatValidationErrors('serving-contract.json', contractCheck.errors));
  }
  const rootDir = path.resolve(root || path.dirname(path.dirname(contractPath)));
  const routeMap = new Map(contract.routes.map((r) => [r.requestPath, r.file]));

  // Contract v2 asset indexes
  const assetEntries = Array.isArray(contract.assets) ? contract.assets : [];
  /** @type {Map<string, string>} `${path}?${query}` -> file (query variants) */
  const exactQueryMap = new Map();
  /** @type {Map<string, string>} path -> file (query-insensitive entries) */
  const plainAssetMap = new Map();
  /** @type {Set<string>} paths that have at least one query-sensitive variant */
  const querySensitivePaths = new Set();
  for (const entry of assetEntries) {
    if (entry.requestQuery) {
      exactQueryMap.set(`${entry.requestPath}?${entry.requestQuery}`, entry.file);
      querySensitivePaths.add(entry.requestPath);
    } else if (!plainAssetMap.has(entry.requestPath)) {
      plainAssetMap.set(entry.requestPath, entry.file);
    }
  }

  /** Resolves a contract-relative file inside rootDir, or null when unsafe/missing. */
  const resolveLocal = (relFile) => {
    const resolved = resolveWithin(rootDir, relFile);
    if (!resolved.ok) return null;
    const abs = resolved.abs;
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return null;
    return abs;
  };

  const logMissing = (requestPath) => {
    if (!missingLog) return;
    fs.mkdirSync(path.dirname(missingLog), { recursive: true });
    fs.appendFileSync(missingLog, `${new Date().toISOString()} ${requestPath}\n`, 'utf8');
  };

  const server = http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end('Method Not Allowed');
      return;
    }

    // Raw traversal check BEFORE any URL normalization (V-01): WHATWG URL parsing
    // collapses '..' silently, so the raw wire string is inspected first.
    const rawCheck = resolveHttpPathname(req.url || '');
    if (!rawCheck.ok) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Forbidden');
      return;
    }
    const pathname = rawCheck.pathname;
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const rawQuery = url.search ? url.search.slice(1) : '';

    let relFile = routeMap.get(pathname) || null;

    // Rewritten asset URLs: identity is encoded in the filename, serve directly
    if (!relFile && pathname.startsWith(ASSETS_PREFIX)) {
      const rel = pathname.slice(ASSETS_PREFIX.length);
      relFile = path.posix.join('mirror', 'assets', ...rel.split('/').filter(Boolean));
    }

    // Original-path assets (dynamic requests, non-rewritten references)
    if (!relFile) {
      const exact = querySensitivePaths.has(pathname) ? exactQueryMap.get(`${pathname}?${rawQuery}`) : null;
      if (exact) {
        relFile = exact;
      } else if (plainAssetMap.has(pathname)) {
        // Declared query-insensitive asset (V-04): serves regardless of query
        relFile = plainAssetMap.get(pathname);
      } else if (querySensitivePaths.has(pathname)) {
        // Query-sensitive path with undeclared query: real 404, never a wrong variant
        logMissing(`${pathname}?${rawQuery} (query não declarada)`);
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not Found');
        return;
      }
    }

    if (!relFile) {
      logMissing(rawQuery ? `${pathname}?${rawQuery}` : pathname);
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not Found');
      return;
    }

    const abs = resolveLocal(relFile);
    if (!abs) {
      logMissing(rawQuery ? `${pathname}?${rawQuery}` : pathname);
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
  try {
    const contractPath = path.resolve(args.contract || 'capture/serving-contract.json');
    const { address } = await createMirrorServer({
      contractPath,
      root: args.root ? path.resolve(args.root) : path.dirname(path.dirname(contractPath)),
      host: args.host || '127.0.0.1',
      port: Number(args.port || 4173),
      missingLog: path.join(path.dirname(contractPath), 'logs', 'server-missing.log'),
    });
    console.log(`[SERVE] Servidor local em http://${address.address}:${address.port}`);
    console.log('[SERVE] spaFallback desativado: 404 real para arquivos ausentes. Ctrl+C para parar.');
  } catch (err) {
    const isConfig = /contract|inválid|ENOENT|JSON/.test(err.message);
    failWith(isConfig ? EXIT.INVALID_CONFIG : EXIT.INTERNAL_ERROR, `[SERVE] Falha ao iniciar: ${err.message}`);
  }
}
