#!/usr/bin/env node
// QAAndEvidence (A-011): validates the local mirror against declared routes/viewports.
// Official validation browser: bundled Playwright Chromium (browser-policy.js).
// Secondary validations (Chrome Stable, Firefox) NEVER modify the official manifest —
// their results live in capture/browser-validation/<engine>/.
//
// Usage: node scripts/validate.js --config mirror.config.yaml [--offline]
//        [--browser chromium|chrome|firefox] [--all-enabled-browsers]
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, resolveProject, requireScopeLock, writeJson, ensureDir, isoNow, sanitizePathname } from './lib/config.js';
import { redactString } from './lib/redact.js';
import { createMirrorServer } from '../server/serve.js';
import { computeAcceptance, buildClassification, acceptanceSentence } from './lib/acceptance.js';
import { EXIT, failWith } from './lib/exit-codes.js';
import { resolveBrowserPolicy, decideSecondaryRun, enabledValidationBrowsers, PASS_DEFINITIONS } from '../browser/browser-policy.js';
import { createCleanContext } from '../browser/context-factory.js';
import { detectChromeStable, detectFirefox, launchValidationBrowser } from '../browser/detect.js';
import { upsertPass, PASS_STATUS } from '../browser/matrix.js';

const VALID_BROWSER_ARGS = ['chromium', 'chrome', 'firefox'];

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

/**
 * Runs the route/viewport validation loop with a given Playwright browser.
 * Browser-agnostic: works with Chromium (any channel) and Firefox.
 */
async function runRouteValidation({ browser, baseUrl, scope, offline, screenshotsDir, shotPrefix }) {
  const viewports = scope.viewports?.length
    ? scope.viewports
    : [
        { name: 'desktop', width: 1440, height: 900 },
        { name: 'mobile', width: 390, height: 844 },
      ];

  const results = {
    routes: [],
    totals: { routesOk: 0, routesFailed: 0, consoleErrors: 0, pageErrors: 0, localFailures: 0, missingFiles: 0, externalAttempts: 0 },
    externalAttempts: [],
    consoleLog: [],
  };

  for (const viewport of viewports) {
    for (const routePath of scope.routes.include) {
      const tag = `${routePath === '/' ? 'index' : sanitizePathname(routePath)}-${viewport.name}`;
      // Every pass starts a NEW context (clean mode): isolated cookies/storage
      const context = await createCleanContext(browser, { viewport: { width: viewport.width, height: viewport.height } });
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

      try {
        const page = await context.newPage();

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
        results.consoleLog.push({ route: routePath, viewport: viewport.name, text });
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
        if (isLocalHost(host)) routeResult.failedRequests.push(request.url());
      });
      page.on('response', (response) => {
        const host = new URL(response.url()).hostname;
        if (isLocalHost(host) && response.status() === 404) routeResult.missingLocal.push(response.url());
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

      ensureDir(screenshotsDir);
      await page.screenshot({ path: path.join(screenshotsDir, `${shotPrefix}-${tag}${offline ? '-offline' : ''}.png`), fullPage: true });
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
      } finally {
        await context.close().catch(() => {});
      }
    }
  }
  return results;
}

async function main() {
  const args = parseArgs(process.argv);
  const offline = Boolean(args.offline);
  const allEnabled = Boolean(args['all-enabled-browsers']);
  const browserArg = args.browser ? String(args.browser) : null;
  if (browserArg && !VALID_BROWSER_ARGS.includes(browserArg)) {
    failWith(EXIT.INVALID_CONFIG, `--browser inválido: ${browserArg}. Válidos: ${VALID_BROWSER_ARGS.join(', ')}.`);
  }

  const project = resolveProject(args.config || 'mirror.config.yaml');
  const scope = requireScopeLock(project);
  const { config } = project;
  const policy = resolveBrowserPolicy(config);

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

  const runOfficial = !browserArg || browserArg === 'chromium' || allEnabled;
  const secondariesRequested = allEnabled
    ? enabledValidationBrowsers(policy).filter((b) => b.id !== 'chromium-offline-validation')
    : browserArg === 'chrome'
      ? [enabledValidationBrowsers(policy).find((b) => b.id === 'chrome-production-validation')]
      : browserArg === 'firefox'
        ? [enabledValidationBrowsers(policy).find((b) => b.id === 'firefox-compatibility')]
        : [];

  // ---- OFFICIAL PASS (Playwright Chromium) — pass 4 when offline ----
  if (runOfficial) {
    console.log(`[VALIDATE] Servidor local em ${baseUrl} ${offline ? '(modo OFFLINE: rede externa bloqueada)' : ''}`);
    console.log('[VALIDATE] Navegador oficial: chromium (playwright) — nova sessão limpa');
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: policy.acquisition.headless, timeout: policy.acquisition.timeoutMs });
    let results;
    let browserVersion;
    let byteRange = null;
    try {
      results = await runRouteValidation({
        browser,
        baseUrl,
        scope,
        offline,
        screenshotsDir: project.dirs.screenshots,
        shotPrefix: 'local',
      });

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
      byteRange = { asset: rangeUrl.replace(baseUrl, ''), sizeBytes: largest.size, ...(await checkByteRange(rangeUrl)) };
      console.log(`  Byte-range: ${byteRange.asset} → HTTP ${byteRange.status} (${byteRange.ok ? '206 OK' : 'FALHOU'})`);
    }

      browserVersion = browser.version();
    } finally {
      await browser.close().catch(() => {});
    }

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

    const resultsDoc = {
      validatedAt: isoNow(),
      offline,
      baseUrl,
      browser: { engine: 'chromium', distribution: 'playwright', version: browserVersion, official: true },
      routes: results.routes,
      totals: results.totals,
      externalAttempts: results.externalAttempts,
      byteRange,
      classification,
    };
    const previousResults = fs.existsSync(project.files.validationResults)
      ? JSON.parse(fs.readFileSync(project.files.validationResults, 'utf8'))
      : null;
    const preserveOfflineL4 =
      !offline &&
      acceptance.level === 'L3' &&
      previousResults?.offline === true &&
      previousResults?.classification?.acceptanceLevel === 'L4';
    if (preserveOfflineL4) {
      console.log('  Evidência oficial offline L4 preservada; a rodada online não substitui o passe offline na browser matrix.');
    } else {
      writeJson(project.files.validationResults, resultsDoc);
    }

    if (fs.existsSync(project.files.manifest)) {
      if (!preserveOfflineL4) manifest.acceptanceLevel = acceptance.level;
      manifest.validationTarget = classification.validationTarget;
      manifest.fixtureId = classification.fixtureId;
      if (!preserveOfflineL4) manifest.lastValidationAt = resultsDoc.validatedAt;
      writeJson(project.files.manifest, manifest);
    }

    if (offline) {
      const passDef = PASS_DEFINITIONS.find((p) => p.id === 'chromium-offline-validation');
      upsertPass(project, {
        id: passDef.id,
        order: passDef.order,
        engine: 'chromium',
        distribution: 'playwright',
        status: results.totals.routesFailed === 0 ? PASS_STATUS.PASSED : PASS_STATUS.FAILED,
        officialAcquisition: false,
        contextMode: 'clean',
        cacheState: 'clean',
      });
    }

    const sentence = acceptanceSentence(classification);
    console.log(`\n[VALIDATE] ${sentence}`);
    if (acceptance.reasons.length > 0) console.log(`  ${acceptance.reasons.join(' ')}`);
    if (acceptance.level === 'L0' || acceptance.level === 'L1') process.exitCode = EXIT.VALIDATION_FAILED;
  }

  // ---- SECONDARY PASSES (Chrome Stable / Firefox) — never touch official artifacts ----
  for (const secondary of secondariesRequested.filter(Boolean)) {
    const isChrome = secondary.id === 'chrome-production-validation';
    const cfg = isChrome
      ? { required: policy.productionValidation.required, enabled: true }
      : { required: policy.compatibility.firefox.required, enabled: policy.compatibility.firefox.enabled };
    const secondaryHeadless = isChrome ? policy.productionValidation.headless : policy.compatibility.firefox.headless;
    const detection = isChrome ? await detectChromeStable({ headless: secondaryHeadless }) : await detectFirefox({ headless: secondaryHeadless });
    const decision = decideSecondaryRun(detection, cfg);
    const passDef = PASS_DEFINITIONS.find((p) => p.id === secondary.id);

    if (decision === 'fail') {
      upsertPass(project, { id: secondary.id, order: passDef.order, engine: passDef.engine, channel: passDef.channel, status: PASS_STATUS.FAILED, reason: detection.reason, officialAcquisition: false });
      failWith(EXIT.DEPENDENCY_MISSING, `${secondary.id} obrigatório mas indisponível: ${detection.reason}`);
    }
    if (decision === 'skip') {
      const reason = cfg.enabled === false ? 'desabilitado na configuração (browser.compatibility_validation)' : detection.reason;
      console.log(`\n[VALIDATE] ${secondary.id}: SKIPPED — ${reason}`);
      upsertPass(project, {
        id: secondary.id,
        order: passDef.order,
        engine: passDef.engine,
        channel: passDef.channel,
        status: cfg.enabled === false ? PASS_STATUS.DISABLED : PASS_STATUS.SKIPPED,
        reason,
        officialAcquisition: false,
      });
      continue;
    }

    console.log(`\n[VALIDATE] ${secondary.id}: executando (${isChrome ? `Chrome Stable ${detection.version}` : `Firefox ${detection.version}`}) — resultados NÃO alteram o manifesto oficial`);
    const engineName = isChrome ? 'chrome' : 'firefox';
    const browser = await launchValidationBrowser(engineName, { headless: secondaryHeadless });
    const outDir = path.join(project.dirs.capture, 'browser-validation', engineName);
    let results;
    let browserVersion;
    try {
      results = await runRouteValidation({
        browser,
        baseUrl,
        scope,
        offline,
        screenshotsDir: path.join(outDir, 'screenshots'),
        shotPrefix: engineName,
      });
      browserVersion = browser.version();
    } finally {
      await browser.close().catch(() => {});
    }

    ensureDir(outDir);
    writeJson(path.join(outDir, 'results.json'), {
      validatedAt: isoNow(),
      engine: engineName,
      version: browserVersion,
      offline,
      officialAcquisition: false,
      note: 'Validação secundária: não modifica manifesto nem nível oficial do Chromium.',
      totals: results.totals,
      routes: results.routes,
    });
    writeJson(path.join(outDir, 'console.json'), results.consoleLog);

    const secondaryOk = results.totals.routesFailed === 0 && results.totals.pageErrors === 0;
    upsertPass(project, {
      id: secondary.id,
      order: passDef.order,
      engine: passDef.engine,
      channel: passDef.channel,
      status: secondaryOk ? PASS_STATUS.PASSED : PASS_STATUS.FAILED,
      officialAcquisition: false,
      contextMode: 'clean',
      cacheState: 'clean',
      details: { version: browserVersion, totals: results.totals },
    });
    const differences = results.totals.consoleErrors;
    const secondaryStatus = secondaryOk
      ? `PASSED${differences > 0 ? ` (${differences} diferença(s) de console registrada(s))` : ''}`
      : 'FAILED (registrado; nível oficial inalterado)';
    console.log(`  ${secondary.id}: ${secondaryStatus}`);
    if (!secondaryOk && browserArg && !allEnabled) {
      process.exitCode = EXIT.VALIDATION_FAILED;
    }
  }

  server.close();
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
