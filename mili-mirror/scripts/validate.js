#!/usr/bin/env node
// QAAndEvidence (A-011): validates the local mirror against declared routes/viewports.
// Acceptance level is COMPUTED from evidence (lib/acceptance.js) and is always scoped
// to the declared target — never a claim about arbitrary websites.
// Usage: node scripts/validate.js --config mirror.config.yaml [--offline]
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { parseArgs, resolveProject, requireScopeLock, writeJson, ensureDir, isoNow, sanitizePathname } from './lib/config.js';
import { redactString } from './lib/redact.js';
import { createMirrorServer } from '../server/serve.js';
import { computeAcceptance, buildClassification, acceptanceSentence } from './lib/acceptance.js';
import { EXIT, failWith } from './lib/exit-codes.js';

function checkByteRange(url) {
  return new Promise((resolve) => {
    const req = http.get(url, { headers: { Range: 'bytes=0-99' } }, (res) => {
      res.resume();
      resolve({
        status: res.statusCode,
        contentRange: res.headers['content-range'] || null,
        acceptRanges: res.headers['accept-ranges'] || null,
        ok: res.statusCode === 206,
      });
    });
    req.on('error', (err) => resolve({ ok: false, error: err.message }));
  });
}

function isLocalHost(hostname) {
  const host = String(hostname).toLowerCase();
  return host === '127.0.0.1' || host === 'localhost' || host === '::1';
}

/**
 * Classifies a console error as mirror-introduced (unexpected) or expected.
 * V-09: network errors are only "expected" when the failing resource is on a
 * NON-LOCAL host (a documented external dependency). Same-origin (local) network
 * errors are never masked by this filter.
 * @param {string} text console message text
 * @param {string} locationUrl URL reported by the console message location (may be '')
 * @returns {'expected-external'|'unexpected'}
 */
export function classifyConsoleError(text, locationUrl) {
  if (!/net::ERR_(BLOCKED_BY_CLIENT|NAME_NOT_RESOLVED|CONNECTION_REFUSED|CONNECTION_FAILED|ABORTED)/.test(text)) {
    return 'unexpected';
  }
  if (!locationUrl) return 'unexpected'; // cannot prove externality: stay strict
  try {
    return isLocalHost(new URL(locationUrl).hostname) ? 'unexpected' : 'expected-external';
  } catch {
    return 'unexpected';
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const offline = Boolean(args.offline);
  const project = resolveProject(args.config || 'mirror.config.yaml');
  const scope = requireScopeLock(project);
  const { config } = project;

  if (!fs.existsSync(project.files.servingContract)) {
    failWith(EXIT.INVALID_CONFIG, 'serving-contract.json ausente. Execute a captura primeiro.');
  }

  let server;
  let address;
  try {
    ({ server, address } = await createMirrorServer({
      contractPath: project.files.servingContract,
      root: project.outputDir,
      host: '127.0.0.1',
      port: 0,
      missingLog: path.join(project.dirs.logs, 'server-missing.log'),
    }));
  } catch (err) {
    failWith(EXIT.INVALID_CONFIG, `serving-contract inválido: ${err.message}`);
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`[VALIDATE] Servidor local em ${baseUrl} ${offline ? '(modo OFFLINE: rede externa bloqueada)' : ''}`);

  const viewports = scope.viewports?.length
    ? scope.viewports
    : [
        { name: 'desktop', width: 1440, height: 900 },
        { name: 'mobile', width: 390, height: 844 },
      ];

  const results = {
    validatedAt: isoNow(),
    offline,
    baseUrl,
    routes: [],
    byteRange: null,
    totals: { routesOk: 0, routesFailed: 0, consoleErrors: 0, pageErrors: 0, localFailures: 0, missingFiles: 0, externalAttempts: 0 },
    externalAttempts: [],
  };

  const browser = await chromium.launch({ headless: true });

  for (const viewport of viewports) {
    for (const routePath of scope.routes.include) {
      const tag = `${routePath === '/' ? 'index' : sanitizePathname(routePath)}-${viewport.name}`;
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
      const page = await context.newPage();
      const routeResult = {
        route: routePath,
        viewport: viewport.name,
        status: null,
        consoleErrors: [],
        expectedExternalErrors: [],
        pageErrors: [],
        failedRequests: [],
        missingLocal: [],
        externalAttempts: [],
        ok: false,
      };

      if (offline) {
        await context.route('**/*', (route) => {
          const request = route.request();
          const host = new URL(request.url()).hostname;
          if (isLocalHost(host)) return route.continue();
          const attempt = { url: request.url(), resourceType: request.resourceType(), route: routePath, viewport: viewport.name };
          routeResult.externalAttempts.push(attempt);
          results.externalAttempts.push(attempt);
          return route.abort('blockedbyclient');
        });
      }

      page.on('console', (msg) => {
        if (msg.type() !== 'error') return;
        const text = redactString(msg.text());
        const locationUrl = msg.location()?.url || '';
        if (classifyConsoleError(text, locationUrl) === 'expected-external') {
          routeResult.expectedExternalErrors.push(text);
        } else {
          routeResult.consoleErrors.push(text);
        }
      });
      page.on('pageerror', (err) => routeResult.pageErrors.push(redactString(String(err))));
      page.on('requestfailed', (request) => {
        const host = new URL(request.url()).hostname;
        if (isLocalHost(host)) {
          routeResult.failedRequests.push(request.url());
        }
      });
      page.on('response', (response) => {
        const host = new URL(response.url()).hostname;
        if (isLocalHost(host) && response.status() === 404) {
          routeResult.missingLocal.push(response.url());
        }
      });

      try {
        const response = await page.goto(`${baseUrl}${routePath}`, { waitUntil: 'load', timeout: 30000 });
        routeResult.status = response ? response.status() : null;
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(500);
        await page.evaluate(() => window.scrollTo(0, 0));
      } catch (err) {
        routeResult.pageErrors.push(`navigation: ${err.message}`);
      }

      ensureDir(project.dirs.screenshots);
      await page.screenshot({ path: path.join(project.dirs.screenshots, `local-${tag}${offline ? '-offline' : ''}.png`), fullPage: true });
      routeResult.ok = routeResult.status === 200 && routeResult.failedRequests.length === 0 && routeResult.missingLocal.length === 0;
      results.routes.push(routeResult);
      results.totals[routeResult.ok ? 'routesOk' : 'routesFailed'] += 1;
      results.totals.consoleErrors += routeResult.consoleErrors.length;
      results.totals.pageErrors += routeResult.pageErrors.length;
      results.totals.localFailures += routeResult.failedRequests.length;
      results.totals.missingFiles += routeResult.missingLocal.length;
      results.totals.externalAttempts += routeResult.externalAttempts.length;
      console.log(
        `  ${routeResult.ok ? 'OK ' : 'FALHA'} ${routePath} @ ${viewport.name} → HTTP ${routeResult.status} | 404s: ${routeResult.missingLocal.length} | erros console: ${routeResult.consoleErrors.length}`,
      );
      await context.close();
    }
  }

  // Byte-range proof: prefer a captured video (with query when present); fallback to the largest asset
  const contract = JSON.parse(fs.readFileSync(project.files.servingContract, 'utf8'));
  const assetEntries = Array.isArray(contract.assets) ? contract.assets : [];
  const withSizes = assetEntries
    .map((entry) => {
      const abs = path.join(project.outputDir, entry.file);
      return fs.existsSync(abs) ? { ...entry, size: fs.statSync(abs).size } : null;
    })
    .filter(Boolean);
  const video = withSizes.filter((e) => e.kind === 'video').sort((a, b) => b.size - a.size)[0];
  const largest = video || withSizes.sort((a, b) => b.size - a.size)[0];
  if (largest) {
    const rangeUrl = `${baseUrl}${largest.requestPath}${largest.requestQuery ? `?${largest.requestQuery}` : ''}`;
    results.byteRange = { asset: rangeUrl.replace(baseUrl, ''), sizeBytes: largest.size, ...(await checkByteRange(rangeUrl)) };
    console.log(`  Byte-range: ${results.byteRange.asset} → HTTP ${results.byteRange.status} (${results.byteRange.ok ? '206 OK' : 'FALHOU'})`);
  }

  await browser.close();
  server.close();

  // Acceptance: computed from evidence (V-02 ordinal scale + ADR-002 policy)
  const manifest = fs.existsSync(project.files.manifest) ? JSON.parse(fs.readFileSync(project.files.manifest, 'utf8')) : {};
  const interactionsNotExercised = manifest.interactionsNotExercised || [];
  const allRoutes200 = results.routes.every((r) => r.status === 200);
  const acceptance = computeAcceptance({
    offline,
    allRoutes200,
    totals: results.totals,
    externalAttempts: results.externalAttempts,
    interactionsNotExercised,
  });
  const classification = buildClassification({
    config,
    scope,
    level: acceptance.level,
    reasons: acceptance.reasons,
    criticalAttempts: acceptance.criticalAttempts,
    optionalAttempts: acceptance.optionalAttempts,
    interactionsNotExercised,
    knownLimitations: [
      'DOM pós-hidratação pode reaplicar efeitos de scripts.',
      'JS dinâmico não é reescrito (ver rewrite-report.json).',
      'Comparação visual origem × local é pós-MVP.',
    ],
  });
  results.classification = classification;
  writeJson(project.files.validationResults, results);

  // Persist into the manifest (level is scoped to the declared target)
  if (fs.existsSync(project.files.manifest)) {
    manifest.acceptanceLevel = offline ? acceptance.level : manifest.acceptanceLevel === 'pending-validation' ? acceptance.level : manifest.acceptanceLevel;
    manifest.validationTarget = classification.validationTarget;
    manifest.fixtureId = classification.fixtureId;
    manifest.lastValidationAt = results.validatedAt;
    writeJson(project.files.manifest, manifest);
  }

  const sentence = acceptanceSentence(classification);
  console.log(`\n[VALIDATE] ${sentence}`);
  if (acceptance.reasons.length > 0) console.log(`  ${acceptance.reasons.join(' ')}`);
  if (acceptance.level === 'L0' || acceptance.level === 'L1') process.exitCode = EXIT.VALIDATION_FAILED;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    if (process.exitCode && process.exitCode !== 0) {
      console.error(`\n[VALIDATE] Falha fatal após falha registrada: ${err.message}`);
      process.exit(process.exitCode);
    }
    failWith(EXIT.INTERNAL_ERROR, `[VALIDATE] Falha fatal: ${err.message}`);
  });
}

export { main as _validateMain };
