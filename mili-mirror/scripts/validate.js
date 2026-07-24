#!/usr/bin/env node
// QAAndEvidence (A-011, MVP): validates the local mirror against declared routes/viewports.
// Usage: node scripts/validate.js --config mirror.config.yaml [--offline]
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';
import { parseArgs, resolveProject, requireScopeLock, writeJson, ensureDir, isoNow, sanitizePathname } from './lib/config.js';
import { redactString } from './lib/redact.js';
import { createMirrorServer } from '../server/serve.js';

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

async function main() {
  const args = parseArgs(process.argv);
  const offline = Boolean(args.offline);
  const project = resolveProject(args.config || 'mirror.config.yaml');
  const scope = requireScopeLock(project);

  if (!fs.existsSync(project.files.servingContract)) {
    throw new Error('serving-contract.json ausente. Execute a captura primeiro.');
  }

  const { server, address } = await createMirrorServer({
    contractPath: project.files.servingContract,
    root: project.outputDir,
    host: '127.0.0.1',
    port: 0,
    missingLog: path.join(project.dirs.logs, 'server-missing.log'),
  });
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
          const host = new URL(route.request().url()).hostname;
          if (host === '127.0.0.1' || host === 'localhost') return route.continue();
          routeResult.externalAttempts.push(route.request().url());
          return route.abort('blockedbyclient');
        });
      }

      page.on('console', (msg) => {
        if (msg.type() !== 'error') return;
        const text = redactString(msg.text());
        // Network errors for origins blocked by the Guardian allowlist are EXPECTED
        // (documented external dependencies), not errors introduced by the mirror.
        if (/net::ERR_(BLOCKED_BY_CLIENT|NAME_NOT_RESOLVED|CONNECTION_REFUSED|CONNECTION_FAILED|ABORTED)/.test(text)) {
          routeResult.expectedExternalErrors.push(text);
        } else {
          routeResult.consoleErrors.push(text);
        }
      });
      page.on('pageerror', (err) => routeResult.pageErrors.push(redactString(String(err))));
      page.on('requestfailed', (request) => {
        const host = new URL(request.url()).hostname;
        if (host === '127.0.0.1' || host === 'localhost') {
          routeResult.failedRequests.push(request.url());
        }
      });
      page.on('response', (response) => {
        const host = new URL(response.url()).hostname;
        if ((host === '127.0.0.1' || host === 'localhost') && response.status() === 404) {
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

  // Byte-range proof against the largest captured asset (MVP-009)
  const contract = JSON.parse(fs.readFileSync(project.files.servingContract, 'utf8'));
  const assetEntries = Object.entries(contract.assets || {});
  let largest = null;
  for (const [serverPath, relFile] of assetEntries) {
    const abs = path.join(project.outputDir, relFile);
    if (!fs.existsSync(abs)) continue;
    const size = fs.statSync(abs).size;
    if (!largest || size > largest.size) largest = { serverPath, relFile, size };
  }
  if (largest) {
    results.byteRange = { asset: largest.serverPath, sizeBytes: largest.size, ...(await checkByteRange(`${baseUrl}${largest.serverPath}`)) };
    console.log(`  Byte-range: ${largest.serverPath} → HTTP ${results.byteRange.status} (${results.byteRange.ok ? '206 OK' : 'FALHOU'})`);
  }

  await browser.close();
  server.close();

  // Acceptance classification (honest, no false completeness)
  const t = results.totals;
  const allRoutes200 = results.routes.every((r) => r.status === 200);
  let level = 'L0';
  const reasons = [];
  if (t.routesOk === 0) {
    reasons.push('Nenhuma rota respondeu corretamente.');
  } else if (allRoutes200 && t.missingFiles === 0 && t.localFailures === 0) {
    level = 'L2';
    if (t.pageErrors === 0 && t.consoleErrors === 0) {
      level = 'L3';
    } else {
      reasons.push(`${t.consoleErrors} erros de console / ${t.pageErrors} pageerrors impedem L3.`);
    }
  } else {
    level = 'L1';
    reasons.push('Rotas com falha, arquivos locais ausentes ou requisições locais quebradas.');
  }
  if (offline && level >= 'L2') {
    level = 'L4';
    reasons.push(`Validação offline concluída; ${t.externalAttempts} tentativas externas registradas.`);
  }
  results.classification = { level, reasons };
  writeJson(project.files.validationResults, results);

  // Persist classification into the manifest
  if (fs.existsSync(project.files.manifest)) {
    const manifest = JSON.parse(fs.readFileSync(project.files.manifest, 'utf8'));
    manifest.acceptanceLevel = offline ? level : manifest.acceptanceLevel === 'pending-validation' ? level : manifest.acceptanceLevel;
    manifest.lastValidationAt = results.validatedAt;
    writeJson(project.files.manifest, manifest);
  }

  console.log(`\n[VALIDATE] Classificação: ${level}${reasons.length ? ` — ${reasons.join(' ')}` : ''}`);
  if (level === 'L0' || level === 'L1') process.exitCode = 1;
}

main().catch((err) => {
  console.error(`\n[VALIDATE] Falha fatal: ${err.message}`);
  process.exit(1);
});
