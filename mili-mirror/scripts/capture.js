#!/usr/bin/env node
// RuntimeScout + RouteAndStateExplorer + AssetAcquisition (A-004/A-005/A-006).
// Opens authorized routes in real Chromium, exercises scroll, captures every response
// body from allowed origins, stores assets query-aware with hashes and writes the
// serving contract v2. Rewriting lives in scripts/rewrite.js.
//
// Usage: node scripts/capture.js --config mirror.config.yaml [--routes /,/sobre] [--headed]
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { chromium } from 'playwright';
import {
  parseArgs,
  resolveProject,
  requireScopeLock,
  writeJson,
  appendJsonl,
  ensureDir,
  isoNow,
  sanitizePathname,
  routeToPageFile,
} from './lib/config.js';
import { sha256Buffer, shortHash, sha256File } from './lib/hash.js';
import { redactString, redactHeaders } from './lib/redact.js';
import { Allowlist } from './lib/allowlist.js';
import { kindForMime } from './lib/mime.js';
import { canonicalizeUrl } from './lib/url-resolver.js';
import { AssetRegistry } from './lib/asset-store.js';
import { EXIT, failWith } from './lib/exit-codes.js';

const MAX_SCROLL_STEPS = 80;
const SCROLL_DELAY_MS = 250;
const MAX_REDIRECTS = 5;

/**
 * Authorized direct download (acquisition strategy #2): full body without Range,
 * following redirects, allowlist-enforced. Used for media and partial (206) responses,
 * where the browser only delivers fragments.
 */
function directDownload(urlString, allowlist) {
  return new Promise((resolve) => {
    const doGet = (current, redirectsLeft, chain) => {
      if (!allowlist.isAllowed(current)) {
        resolve({ ok: false, error: 'not-authorized', chain });
        return;
      }
      const mod = current.startsWith('https:') ? https : http;
      const req = mod.get(current, { headers: { 'User-Agent': 'nt-site-mirror/direct-fetch' } }, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          res.resume();
          if (redirectsLeft === 0) {
            resolve({ ok: false, error: 'redirect-limit', chain });
            return;
          }
          doGet(new URL(res.headers.location, current).toString(), redirectsLeft - 1, [...chain, current]);
          return;
        }
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks),
            chain,
            finalUrl: current,
          });
        });
      });
      req.on('error', (err) => resolve({ ok: false, error: err.message, chain }));
      req.setTimeout(120000, () => req.destroy(new Error('timeout')));
    };
    doGet(urlString, MAX_REDIRECTS, []);
  });
}

async function exerciseScroll(page, viewportHeight) {
  let lastHeight = 0;
  for (let step = 0; step < MAX_SCROLL_STEPS; step += 1) {
    const state = await page.evaluate(() => ({
      y: window.scrollY,
      height: document.documentElement.scrollHeight,
      inner: window.innerHeight,
    }));
    if (state.y + state.inner >= state.height - 2 && state.height === lastHeight) break;
    lastHeight = state.height;
    await page.evaluate((delta) => window.scrollBy(0, delta), Math.floor(viewportHeight * 0.8));
    await page.waitForTimeout(SCROLL_DELAY_MS);
  }
  try {
    await page.waitForLoadState('networkidle', { timeout: 8000 });
  } catch {
    // networkidle is best-effort; late long-polling must not block capture
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
}

async function main() {
  const args = parseArgs(process.argv);
  const configPath = args.config || 'mirror.config.yaml';
  const project = resolveProject(configPath);
  const { config } = project;
  const scope = requireScopeLock(project);

  const sourceUrl = config.source.url;
  const allowlist = new Allowlist(scope.domains);
  const routes = args.routes ? String(args.routes).split(',').map((r) => r.trim()) : scope.routes.include;
  const viewports = scope.viewports?.length
    ? scope.viewports
    : [
        { name: 'desktop', width: 1440, height: 900 },
        { name: 'mobile', width: 390, height: 844 },
      ];

  const maxBytes = (config?.capture?.max_total_download_gb ?? 20) * 1024 ** 3;
  const rateLimit = Math.max(1, Number(config?.capture?.rate_limit_requests_per_second ?? 4));

  for (const dir of Object.values(project.dirs)) ensureDir(dir);
  if (fs.existsSync(project.files.acquisitionRecords)) fs.rmSync(project.files.acquisitionRecords);

  const startedAt = isoNow();
  const captureId = `cap_${startedAt.slice(0, 10).replaceAll('-', '_')}_${shortHash(startedAt, 6)}`;
  const records = [];
  const blocked = [];
  const failed = [];
  const redirects = [];
  const consoleByRoute = {};
  const registry = new AssetRegistry();
  const directMediaQueue = new Map(); // canonical -> { url, routePath, viewportName, chain }
  let totalBytes = 0;
  let sizeCapHit = false;
  let requestsObserved = 0;

  const interactionsDeclared = Object.entries(config?.interactions || {})
    .filter(([, v]) => v === true)
    .map(([k]) => k);
  const interactionsExercised = new Set();

  console.log(`[CAPTURE] Origem: ${sourceUrl}`);
  console.log(`[CAPTURE] Rotas: ${routes.join(', ')} | Viewports: ${viewports.map((v) => v.name).join(', ')}`);

  const browser = await chromium.launch({ headless: !args.headed });
  const browserVersion = browser.version();

  const recordAcquisition = (record) => {
    records.push(record);
    appendJsonl(project.files.acquisitionRecords, record);
  };

  const storeBody = (body, url, contentType, extra) => {
    if (sizeCapHit || totalBytes + body.length > maxBytes) {
      sizeCapHit = true;
      return { entry: null, stored: false, classification: 'blocked' };
    }
    const entry = registry.register(url, contentType, extra);
    const localAbs = path.join(project.outputDir, entry.localRel);
    if (!fs.existsSync(localAbs)) {
      ensureDir(path.dirname(localAbs));
      fs.writeFileSync(localAbs, body);
      totalBytes += body.length;
    }
    return { entry, stored: true, classification: 'captured' };
  };

  for (const viewport of viewports) {
    for (const routePath of routes) {
      const target = new URL(routePath, sourceUrl).toString();
      const tag = `${routePath === '/' ? 'index' : sanitizePathname(routePath)}-${viewport.name}`;
      console.log(`\n[CAPTURE] ${target} @ ${viewport.name} (${viewport.width}x${viewport.height})`);

      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        ignoreHTTPSErrors: true,
      });
      const page = await context.newPage();
      consoleByRoute[tag] = [];
      const pendingWrites = [];
      let lastRequestAt = 0;

      await page.route('**/*', async (route) => {
        const request = route.request();
        const url = request.url();
        if (url.startsWith('http:') || url.startsWith('https:')) {
          requestsObserved += 1;
          if (!allowlist.isAllowed(url)) {
            blocked.push({ url, route: routePath, viewport: viewport.name, resourceType: request.resourceType() });
            appendJsonl(path.join(project.dirs.logs, 'blocked-external.jsonl'), {
              url,
              route: routePath,
              viewport: viewport.name,
            });
            return route.abort('blockedbyclient');
          }
          const now = Date.now();
          const wait = Math.max(0, 1000 / rateLimit - (now - lastRequestAt));
          if (wait > 0) await new Promise((r) => setTimeout(r, wait));
          lastRequestAt = Date.now();
        }
        return route.continue();
      });

      page.on('console', (msg) => {
        consoleByRoute[tag].push({ type: msg.type(), text: redactString(msg.text()) });
      });
      page.on('pageerror', (err) => {
        consoleByRoute[tag].push({ type: 'pageerror', text: redactString(String(err)) });
      });
      page.on('requestfailed', (request) => {
        const url = request.url();
        if (!allowlist.isAllowed(url)) return; // already logged as blocked
        failed.push({
          url,
          route: routePath,
          viewport: viewport.name,
          error: request.failure()?.errorText || 'unknown',
        });
      });
      page.on('response', (response) => {
        const request = response.request();
        const chain = [];
        let cursor = request;
        while (cursor.redirectedFrom()) {
          cursor = cursor.redirectedFrom();
          chain.unshift(cursor.url());
        }
        if (chain.length > 0) {
          redirects.push({ from: chain[0], to: request.url(), chain: [...chain, request.url()] });
        }
        if (!request.url().startsWith('http')) return;
        if (!allowlist.isAllowed(request.url())) return;
        const status = response.status();
        if (status < 200 || status >= 300) {
          if (status >= 400) failed.push({ url: request.url(), route: routePath, viewport: viewport.name, error: `HTTP ${status}` });
          return;
        }

        const url = new URL(request.url());
        const canonical = canonicalizeUrl(url);
        if (registry.has(canonical)) return;

        const contentType = response.headers()['content-type'] || 'application/octet-stream';
        const kind = kindForMime(contentType);

        // Media and partial (206) responses: browser only delivers fragments.
        // Queue an authorized direct download instead of storing partial bodies.
        if (kind === 'video' || kind === 'audio' || status === 206) {
          if (!directMediaQueue.has(canonical)) {
            directMediaQueue.set(canonical, { url: request.url(), routePath, viewportName: viewport.name, chain, contentType, kind });
          }
          return;
        }

        pendingWrites.push(
          (async () => {
            let body;
            try {
              body = await response.body();
            } catch (err) {
              failed.push({ url: request.url(), route: routePath, viewport: viewport.name, error: `body: ${err.message}` });
              return;
            }
            const { entry, stored, classification } = storeBody(body, url, contentType, { kind });
            if (!entry) {
              recordAcquisition({
                sourceUrl: request.url(),
                canonical,
                localPath: null,
                requestPath: url.pathname,
                requestQuery: url.search.slice(1),
                status,
                contentType: contentType.split(';')[0],
                kind,
                sizeBytes: body.length,
                sha256: sha256Buffer(body),
                acquisitionMethod: 'browser-response',
                routeDiscovered: routePath,
                interactionDiscovered: 'initial-load',
                redirectChain: chain,
                classification: 'blocked',
                headers: redactHeaders(response.headers()),
              });
              return;
            }

            recordAcquisition({
              sourceUrl: request.url(),
              canonical: entry.canonical,
              localPath: stored ? entry.localRel.replaceAll(path.sep, '/') : null,
              requestPath: entry.requestPath,
              requestQuery: entry.requestQuery,
              status,
              contentType: entry.contentType,
              kind,
              sizeBytes: body.length,
              sha256: sha256Buffer(body),
              acquisitionMethod: 'browser-response',
              routeDiscovered: routePath,
              interactionDiscovered: 'initial-load',
              redirectChain: chain,
              classification,
              headers: redactHeaders(response.headers()),
            });

            // Redirect aliases: pre-redirect URLs resolve to the final stored file
            for (const aliasUrlString of chain) {
              const aliasUrl = new URL(aliasUrlString);
              const aliasCanonical = canonicalizeUrl(aliasUrl);
              if (registry.has(aliasCanonical)) continue;
              // localRel forced at registration time (V-03): bookkeeping is never stale
              const aliasEntry = registry.register(aliasUrl, contentType, { kind, viaRedirect: true, localRel: entry.localRel });
              recordAcquisition({
                sourceUrl: aliasUrlString,
                canonical: aliasCanonical,
                localPath: entry.localRel.replaceAll(path.sep, '/'),
                requestPath: aliasEntry.requestPath,
                requestQuery: aliasEntry.requestQuery,
                status,
                contentType: entry.contentType,
                kind,
                sizeBytes: body.length,
                sha256: sha256Buffer(body),
                acquisitionMethod: 'redirect-alias',
                routeDiscovered: routePath,
                interactionDiscovered: 'initial-load',
                redirectChain: [...chain, request.url()],
                classification: 'captured',
                viaRedirect: true,
                headers: redactHeaders(response.headers()),
              });
            }
          })(),
        );
      });

      let navigated = false;
      try {
        await page.goto(target, { waitUntil: 'load', timeout: 60000 });
        navigated = true;
      } catch (err) {
        failed.push({ url: target, route: routePath, viewport: viewport.name, error: `navigation: ${err.message}` });
      }

      if (navigated && config?.interactions?.scroll !== false) {
        try {
          await exerciseScroll(page, viewport.height);
          interactionsExercised.add('scroll');
        } catch (err) {
          failed.push({ url: target, route: routePath, viewport: viewport.name, error: `scroll: ${err.message}` });
        }
      }

      // DOM snapshot per viewport
      let html = '';
      try {
        html = await page.content();
      } catch (err) {
        failed.push({ url: target, route: routePath, viewport: viewport.name, error: `content: ${err.message}` });
      }
      if (html) {
        ensureDir(project.dirs.snapshots);
        fs.writeFileSync(path.join(project.dirs.snapshots, `${tag}.html`), html, 'utf8');
        try {
          await page.screenshot({ path: path.join(project.dirs.screenshots, `${tag}.png`), fullPage: true });
        } catch (err) {
          failed.push({ url: target, route: routePath, viewport: viewport.name, error: `screenshot: ${err.message}` });
        }
      }

      // Canonical page HTML comes from the first viewport
      if (html && viewport === viewports[0]) {
        const pageFile = routeToPageFile(routePath);
        ensureDir(path.dirname(path.join(project.outputDir, pageFile)));
        fs.writeFileSync(path.join(project.outputDir, pageFile), html, 'utf8');
      }

      await Promise.allSettled(pendingWrites);
      writeJson(path.join(project.dirs.logs, `console-${tag}.json`), consoleByRoute[tag]);
      await context.close();
      console.log(`  → ${records.length} recursos acumulados | bloqueados: ${blocked.length} | falhas: ${failed.length}`);
    }
  }

  await browser.close();

  // Direct downloads for media / partial responses (authorized, full body, no Range)
  for (const [canonical, item] of directMediaQueue) {
    if (registry.has(canonical)) continue;
    console.log(`  ↓ download direto (mídia/206): ${item.url}`);
    const result = await directDownload(item.url, allowlist);
    if (!result.ok) {
      failed.push({ url: item.url, route: item.routePath, viewport: item.viewportName, error: `direct-download: ${result.error || `HTTP ${result.status}`}` });
      recordAcquisition({
        sourceUrl: item.url,
        canonical,
        localPath: null,
        requestPath: new URL(item.url).pathname,
        requestQuery: new URL(item.url).search.slice(1),
        status: result.status || 0,
        contentType: item.contentType.split(';')[0],
        kind: item.kind,
        sizeBytes: 0,
        sha256: null,
        acquisitionMethod: 'direct-download',
        routeDiscovered: item.routePath,
        interactionDiscovered: 'initial-load',
        redirectChain: result.chain || item.chain,
        classification: 'missing',
      });
      continue;
    }
    const finalUrl = new URL(result.finalUrl);
    const contentType = result.headers['content-type'] || item.contentType;
    const kind = kindForMime(contentType);
    const { entry, classification } = storeBody(result.body, finalUrl, contentType, { kind });
    const record = {
      sourceUrl: item.url,
      canonical: entry ? entry.canonical : canonical,
      localPath: entry ? entry.localRel.replaceAll(path.sep, '/') : null,
      requestPath: entry ? entry.requestPath : new URL(item.url).pathname,
      requestQuery: entry ? entry.requestQuery : new URL(item.url).search.slice(1),
      status: result.status,
      contentType: String(contentType).split(';')[0],
      kind,
      sizeBytes: result.body.length,
      sha256: sha256Buffer(result.body),
      acquisitionMethod: 'direct-download',
      routeDiscovered: item.routePath,
      interactionDiscovered: 'initial-load',
      redirectChain: [...item.chain, ...result.chain],
      classification,
      headers: redactHeaders(result.headers),
    };
    recordAcquisition(record);
    if (record.redirectChain.length > 0) redirects.push({ from: item.url, to: result.finalUrl, chain: [...item.chain, ...result.chain, result.finalUrl] });
  }

  // Serving contract v2 (query-aware)
  const contractAssets = registry
    .values()
    .filter((entry) => entry.kind !== 'html')
    .map((entry) => ({
      requestPath: entry.requestPath,
      requestQuery: entry.requestQuery,
      file: entry.localRel.replaceAll(path.sep, '/'),
      contentType: entry.contentType,
      kind: entry.kind,
      ...(entry.viaRedirect ? { viaRedirect: true } : {}),
    }));
  const contract = {
    version: 2,
    host: '127.0.0.1',
    port: 4173,
    routes: routes.map((routePath) => ({
      requestPath: routePath,
      file: routeToPageFile(routePath).replaceAll(path.sep, '/'),
      contentType: 'text/html',
    })),
    assets: contractAssets,
    querySensitiveAssets: true,
    byteRangeSupport: true,
    spaFallback: false,
    notes: [
      'Assets com variantes de query exigem correspondência exata de query; queries não declaradas retornam 404.',
      'Assets sem query são query-insensitive: queries arbitrárias são ignoradas.',
      'Aliases de redirect servem o conteúdo final (o mirror não reproduz status 30x).',
    ],
  };
  writeJson(project.files.servingContract, contract);

  // Page metadata for the rewriting phase
  writeJson(path.join(project.dirs.capture, 'pages-meta.json'), routes.map((routePath) => ({
    route: routePath,
    url: new URL(routePath, sourceUrl).toString(),
    file: routeToPageFile(routePath).replaceAll(path.sep, '/'),
  })));

  // Hashes of every mirrored file (pre-rewrite; rewrite.js regenerates after rewriting)
  const hashLines = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else hashLines.push(`${sha256File(full)}  ${path.relative(project.outputDir, full).replaceAll(path.sep, '/')}`);
    }
  };
  walk(project.dirs.mirror);
  fs.writeFileSync(project.files.hashes, `${hashLines.join('\n')}\n`, 'utf8');

  writeJson(path.join(project.dirs.capture, 'redirects.json'), redirects);
  writeJson(path.join(project.dirs.logs, 'network-failures.json'), failed);

  const localCount = records.filter((r) => r.classification === 'captured').length;
  const manifest = {
    captureId,
    projectId: scope.projectId,
    startedAt,
    completedAt: isoNow(),
    source: sourceUrl,
    authorizationHash: scope.authorizationHash,
    toolVersion: '1.0.0',
    browser: { name: 'chromium', version: browserVersion },
    routesDeclared: routes.length,
    routesExercised: routes.length,
    interactionsDeclared: interactionsDeclared.length,
    interactionsExercised: interactionsExercised.size,
    interactionsNotExercised: interactionsDeclared.filter((i) => !interactionsExercised.has(i)),
    requestsObserved,
    resourcesLocal: localCount,
    resourcesExternal: 0,
    resourcesBlocked: blocked.length,
    resourcesFailed: failed.length,
    directDownloads: directMediaQueue.size,
    sizeCapHit,
    acceptanceLevel: 'pending-validation',
  };
  writeJson(project.files.manifest, manifest);

  console.log('\n[CAPTURE] Concluída.');
  console.log(`  Recursos locais: ${localCount} | Bloqueados (fora da allowlist): ${blocked.length} | Falhas: ${failed.length}`);
  console.log(`  Downloads diretos (mídia/206): ${directMediaQueue.size}`);
  console.log(`  Manifesto: ${project.files.manifest}`);
}

main().catch((err) => {
  const code = /scope\.lock|Escopo não aprovado|autoriz/i.test(err.message) ? EXIT.AUTHORIZATION_DENIED : EXIT.CAPTURE_FAILED;
  failWith(code, `[CAPTURE] Falha fatal: ${err.message}`);
});
