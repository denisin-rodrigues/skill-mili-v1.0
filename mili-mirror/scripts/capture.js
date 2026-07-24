#!/usr/bin/env node
// RuntimeScout + RouteAndStateExplorer + AssetAcquisition (A-004/A-005/A-006, MVP).
// Opens authorized routes in real Chromium, exercises scroll, captures every response
// body from allowed origins, stores assets with hashes and writes the serving contract.
//
// Usage: node scripts/capture.js --config mirror.config.yaml [--routes /,/sobre] [--headed]
import fs from 'node:fs';
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
import { kindForMime, extForMime } from './lib/mime.js';

const MAX_SCROLL_STEPS = 80;
const SCROLL_DELAY_MS = 250;

function assetPaths(project, url, contentType) {
  const host = url.hostname.toLowerCase();
  let pathname = decodeURIComponent(url.pathname || '/');
  if (pathname.endsWith('/')) pathname = `${pathname}index`;
  let rel = sanitizePathname(pathname);
  if (!path.posix.extname(rel)) {
    const ext = extForMime(contentType);
    if (ext) rel += ext;
  }
  if (url.search) {
    const ext = path.posix.extname(rel);
    const base = ext ? rel.slice(0, -ext.length) : rel;
    rel = `${base}__q_${shortHash(url.search)}${ext}`;
  }
  const localRel = path.join('mirror', 'assets', host, ...rel.split('/'));
  return { localRel, localAbs: path.join(project.outputDir, localRel) };
}

/** Path the browser would request on the local server for this asset. */
function serverPathFor(url, primaryHost) {
  const host = url.hostname.toLowerCase();
  if (host === primaryHost) return decodeURIComponent(url.pathname) || '/';
  return `/__ext/${host}${decodeURIComponent(url.pathname)}`;
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
  const primaryHost = new URL(sourceUrl).hostname.toLowerCase();
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
  const rewriteMap = new Map(); // absolute URL -> local server path
  const assetsByServerPath = new Map(); // server path -> local relative file
  const seenUrls = new Set();
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
        if (seenUrls.has(request.url())) return;
        seenUrls.add(request.url());

        pendingWrites.push(
          (async () => {
            let body;
            try {
              body = await response.body();
            } catch (err) {
              failed.push({ url: request.url(), route: routePath, viewport: viewport.name, error: `body: ${err.message}` });
              return;
            }
            const url = new URL(request.url());
            const contentType = response.headers()['content-type'] || 'application/octet-stream';
            const { localRel, localAbs } = assetPaths(project, url, contentType);
            const sha256 = sha256Buffer(body);
            let classification = 'captured';
            let stored = true;

            if (sizeCapHit || totalBytes + body.length > maxBytes) {
              sizeCapHit = true;
              classification = 'blocked';
              stored = false;
            } else if (!fs.existsSync(localAbs)) {
              ensureDir(path.dirname(localAbs));
              fs.writeFileSync(localAbs, body);
              totalBytes += body.length;
            }

            const serverPath = serverPathFor(url, primaryHost);
            const kind = kindForMime(contentType);
            // HTML documents are served via the routes map; they stay out of the assets map
            if (stored && kind !== 'html' && !assetsByServerPath.has(serverPath)) {
              assetsByServerPath.set(serverPath, localRel);
              rewriteMap.set(request.url(), serverPath);
            }

            recordAcquisition({
              sourceUrl: request.url(),
              localPath: stored ? localRel.replaceAll(path.sep, '/') : null,
              serverPath,
              status,
              contentType: contentType.split(';')[0],
              kind,
              sizeBytes: body.length,
              sha256,
              acquisitionMethod: 'browser-response',
              routeDiscovered: routePath,
              interactionDiscovered: 'initial-load',
              redirectChain: chain,
              classification: stored ? classification : 'blocked',
              headers: redactHeaders(response.headers()),
            });
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

  // Rewrite captured absolute URLs inside HTML pages and CSS files
  let rewriteCount = 0;
  const rewriteText = (text) => {
    let out = text;
    for (const [absoluteUrl, serverPath] of rewriteMap) {
      const protocolRelative = absoluteUrl.replace(/^https?:/, '');
      const before = out;
      out = out.split(absoluteUrl).join(serverPath);
      out = out.split(protocolRelative).join(serverPath);
      if (out !== before) rewriteCount += 1;
    }
    return out;
  };
  for (const record of records) {
    if (!record.localPath || !['html', 'css'].includes(record.kind)) continue;
    const abs = path.join(project.outputDir, record.localPath);
    if (fs.existsSync(abs)) fs.writeFileSync(abs, rewriteText(fs.readFileSync(abs, 'utf8')), 'utf8');
  }
  for (const routePath of routes) {
    const pageFile = path.join(project.outputDir, routeToPageFile(routePath));
    if (fs.existsSync(pageFile)) fs.writeFileSync(pageFile, rewriteText(fs.readFileSync(pageFile, 'utf8')), 'utf8');
  }

  // Serving contract
  const contract = {
    host: '127.0.0.1',
    port: 4173,
    routes: routes.map((routePath) => ({
      requestPath: routePath,
      file: routeToPageFile(routePath).replaceAll(path.sep, '/'),
      contentType: 'text/html',
    })),
    assets: Object.fromEntries([...assetsByServerPath.entries()].map(([k, v]) => [k, v.replaceAll(path.sep, '/')])),
    querySensitiveAssets: false,
    byteRangeSupport: true,
    spaFallback: false,
    notes: ['Consultas (query strings) são ignoradas na resolução de assets; colisões registradas em KNOWN-GAPS.'],
  };
  writeJson(project.files.servingContract, contract);

  // Hashes of every mirrored file
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
    sizeCapHit,
    acceptanceLevel: 'pending-validation',
  };
  writeJson(project.files.manifest, manifest);

  console.log('\n[CAPTURE] Concluída.');
  console.log(`  Recursos locais: ${localCount} | Bloqueados (fora da allowlist): ${blocked.length} | Falhas: ${failed.length}`);
  console.log(`  Reescritas de URL em HTML/CSS: ${rewriteCount}`);
  console.log(`  Manifesto: ${project.files.manifest}`);
}

main().catch((err) => {
  console.error(`\n[CAPTURE] Falha fatal: ${err.message}`);
  process.exit(1);
});
