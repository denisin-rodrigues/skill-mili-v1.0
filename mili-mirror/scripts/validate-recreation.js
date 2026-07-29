#!/usr/bin/env node
// QAAndEvidence for Editable Recreation (PH-004): validates the declared
// recreation slice in official Playwright Chromium, clean desktop/mobile
// contexts and a dedicated prefers-reduced-motion pass.
// Usage: node scripts/validate-recreation.js --config mirror.config.yaml [--output recreation]
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';
import { createCleanContext } from '../browser/context-factory.js';
import { resolveBrowserPolicy } from '../browser/browser-policy.js';
import { ensureDir, isoNow, parseArgs, requireScopeLock, resolveProject, writeJson } from './lib/config.js';
import { EXIT, failWith } from './lib/exit-codes.js';
import { resolveHttpPathname, resolveWithin } from './lib/safe-path.js';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'x-content-type-options': 'nosniff', ...headers });
  res.end(body);
}

function existingFile(root, relative) {
  const resolved = resolveWithin(root, relative);
  if (resolved.ok === false) return null;
  if (!fs.existsSync(resolved.abs) || !fs.statSync(resolved.abs).isFile()) return null;
  return resolved.abs;
}

async function startStaticServer(distRoot) {
  const server = http.createServer((req, res) => {
    if (!['GET', 'HEAD'].includes(req.method || 'GET')) {
      send(res, 405, 'Method Not Allowed');
      return;
    }
    const raw = resolveHttpPathname(req.url || '/');
    if (raw.ok === false) {
      send(res, 403, 'Forbidden');
      return;
    }
    const relative = raw.pathname === '/' ? 'index.html' : raw.pathname.replace(/^\/+/, '');
    let filePath = existingFile(distRoot, relative);
    if (!filePath) {
      // Vite (appType: 'spa') serve index.html para rotas client-side sem extensão
      // (ex.: /work/<slug>). Reproduzimos o mesmo comportamento aqui para validar
      // navegação direta às rotas de case; arquivos com extensão continuam 404 real.
      const isNavigationRoute = path.extname(relative) === '';
      filePath = isNavigationRoute ? existingFile(distRoot, 'index.html') : null;
      if (!filePath) {
        send(res, 404, 'Not Found');
        return;
      }
    }
    const body = fs.readFileSync(filePath);
    const headers = {
      'content-type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'content-length': String(body.length),
    };
    if (req.method === 'HEAD') {
      res.writeHead(200, { 'x-content-type-options': 'nosniff', ...headers });
      res.end();
      return;
    }
    send(res, 200, body, headers);
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(undefined));
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Servidor da Recreation não forneceu uma porta local válida.');
  return { server, baseUrl: `http://127.0.0.1:${address.port}/` };
}

function scenariosFor(scope) {
  const viewports = scope.viewports?.length
    ? scope.viewports
    : [
        { name: 'desktop', width: 1440, height: 900 },
        { name: 'mobile', width: 390, height: 844 },
      ];
  const scenarios = viewports.map((viewport) => ({
    name: viewport.name,
    viewport: { width: viewport.width, height: viewport.height },
    reducedMotion: 'no-preference',
  }));
  const desktop = viewports.find((viewport) => viewport.name === 'desktop') || viewports[0];
  scenarios.push({
    name: 'reduced-motion',
    viewport: { width: desktop.width, height: desktop.height },
    reducedMotion: 'reduce',
  });
  return scenarios;
}

async function validateScenario(browser, baseUrl, outputDir, scenario, expectedProjectCount) {
  const context = await createCleanContext(browser, {
    viewport: scenario.viewport,
    extra: { reducedMotion: scenario.reducedMotion },
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const externalRequests = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => {
    failedRequests.push(`${request.url()} — ${request.failure()?.errorText || 'failed'}`);
  });
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) externalRequests.push(request.url());
  });

  try {
    const response = await page.goto(baseUrl, { waitUntil: 'networkidle' });
    const initialFacts = await page.evaluate((expectedProjects) => {
      const textNodes = [...document.querySelectorAll('.hero h1 span, .hero-subtitle span, .project-title, .project-meta')];
      const textClipping = textNodes.map((node) => {
        const rect = node.getBoundingClientRect();
        return {
          text: node.textContent,
          left: rect.left,
          right: rect.right,
          clipped: rect.left < -1 || rect.right > window.innerWidth + 1,
        };
      });
      const butter = document.querySelector('.butter-object');
      return {
        title: document.title,
        h1: document.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim() || '',
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        butterAnimationDuration: butter ? getComputedStyle(butter).animationDuration : '0s',
        expectedProjects,
        textClipping,
      };
    }, expectedProjectCount);
    await page.evaluate(() => document.querySelector('#studio')?.scrollIntoView({ block: 'center' }));
    await page.waitForFunction(() => Number.parseFloat(getComputedStyle(document.querySelector('#about-title')).opacity) >= 0.99);
    if (expectedProjectCount > 0) {
      await page.locator('#work-title').scrollIntoViewIfNeeded();
      await page.waitForFunction(
        () => Number.parseFloat(getComputedStyle(document.querySelector('#work-title')).opacity) >= 0.99,
      );
      const projectCards = page.locator('[data-project-card]');
      for (let index = 0; index < (await projectCards.count()); index += 1) {
        await projectCards.nth(index).scrollIntoViewIfNeeded();
      }
      await page.waitForFunction(
        (expectedProjects) =>
          [...document.querySelectorAll('[data-project-card]')].length === expectedProjects &&
          [...document.querySelectorAll('[data-project-card]')].every(
            (card) => Number.parseFloat(getComputedStyle(card).opacity) >= 0.99,
          ),
        expectedProjectCount,
      );
    }
    const scrolledFacts = await page.evaluate(() => ({
      about: document.querySelector('#about-title')?.textContent?.replace(/\s+/g, ' ').trim() || '',
      aboutOpacity: getComputedStyle(document.querySelector('#about-title')).opacity,
      workTitle: document.querySelector('#work-title')?.textContent?.replace(/\s+/g, ' ').trim() || '',
      workTitleOpacity: document.querySelector('#work-title')
        ? getComputedStyle(document.querySelector('#work-title')).opacity
        : '0',
      projectCount: document.querySelectorAll('[data-project-card]').length,
      projectsVisible: [...document.querySelectorAll('[data-project-card]')].every(
        (card) => Number.parseFloat(getComputedStyle(card).opacity) >= 0.99,
      ),
    }));
    await page.screenshot({ path: path.join(outputDir, `${scenario.name}.png`), fullPage: true });

    const animationSeconds = Number.parseFloat(initialFacts.butterAnimationDuration);
    const checks = {
      http200: response?.status() === 200,
      title: initialFacts.title !== '' && initialFacts.title !== 'Editable Recreation',
      heroContent: initialFacts.h1 !== '',
      aboutContent: scrolledFacts.about !== '',
      aboutRevealed: Number.parseFloat(scrolledFacts.aboutOpacity) >= 0.99,
      projectsContent:
        expectedProjectCount === 0 ||
        (scrolledFacts.workTitle !== '' &&
          Number.parseFloat(scrolledFacts.workTitleOpacity) >= 0.99 &&
          scrolledFacts.projectCount === expectedProjectCount),
      projectsRevealed: expectedProjectCount === 0 || scrolledFacts.projectsVisible,
      noHorizontalOverflow: initialFacts.horizontalOverflow === false,
      noTextClipping: initialFacts.textClipping.every((item) => item.clipped === false),
      consoleClean: consoleErrors.length === 0,
      pageClean: pageErrors.length === 0,
      requestsClean: failedRequests.length === 0,
      localOnly: externalRequests.length === 0,
      reducedMotionApplied:
        scenario.reducedMotion !== 'reduce' || (initialFacts.reducedMotion && animationSeconds <= 0.00001),
    };
    return {
      ...scenario,
      status: response?.status() || null,
      facts: { ...initialFacts, ...scrolledFacts },
      checks,
      consoleErrors,
      pageErrors,
      failedRequests,
      externalRequests,
      ok: Object.values(checks).every(Boolean),
    };
  } finally {
    await context.close();
  }
}

async function validateCaseRoute(browser, baseUrl, outputDir, caseProject, allCases) {
  const context = await createCleanContext(browser, { viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const externalRequests = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => {
    failedRequests.push(`${request.url()} — ${request.failure()?.errorText || 'failed'}`);
  });
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) externalRequests.push(request.url());
  });

  try {
    const url = new URL(`work/${caseProject.slug}`, baseUrl).toString();
    const response = await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForFunction(
      () => Number.parseFloat(getComputedStyle(document.querySelector('#case-title')).opacity) >= 0.99,
    );
    const facts = await page.evaluate(() => {
      const image = document.querySelector('[data-case-image]');
      return {
        title: document.title,
        h1: document.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim() || '',
        detail: document.querySelector('.case-detail')?.textContent?.replace(/\s+/g, ' ').trim() || '',
        imageSrc: image?.getAttribute('src') || null,
        imageLoaded: image instanceof HTMLImageElement ? image.complete && image.naturalWidth > 0 : false,
        paginationLinks: [...document.querySelectorAll('.case-pagination a')].map((a) => a.getAttribute('href')),
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      };
    });
    await page.screenshot({ path: path.join(outputDir, `case-${caseProject.slug}.png`), fullPage: true });

    const expectedRoutes = new Set(allCases.map((item) => `/work/${item.slug}`));
    const checks = {
      http200: response?.status() === 200,
      titleMatches: facts.title.includes(caseProject.title),
      headingMatches: facts.h1 === caseProject.title,
      detailRendered: facts.detail.length > 0,
      imageSrcMatches: facts.imageSrc === caseProject.image,
      imageLoaded: facts.imageLoaded === true,
      paginationValid:
        allCases.length < 2 ||
        (facts.paginationLinks.length === 2 && facts.paginationLinks.every((href) => expectedRoutes.has(href))),
      noHorizontalOverflow: facts.horizontalOverflow === false,
      consoleClean: consoleErrors.length === 0,
      pageClean: pageErrors.length === 0,
      requestsClean: failedRequests.length === 0,
      localOnly: externalRequests.length === 0,
    };
    return {
      slug: caseProject.slug,
      status: response?.status() || null,
      facts,
      checks,
      consoleErrors,
      pageErrors,
      failedRequests,
      externalRequests,
      ok: Object.values(checks).every(Boolean),
    };
  } finally {
    await context.close();
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.config) {
    failWith(EXIT.INVALID_CONFIG, 'Uso: node scripts/validate-recreation.js --config <mirror.config.yaml> [--output recreation]');
  }
  const project = resolveProject(args.config);
  const scope = requireScopeLock(project);
  const outputName = args.output ? String(args.output) : 'recreation';
  const outputResolution = resolveWithin(project.outputDir, outputName);
  if (outputResolution.ok === false) {
    failWith(EXIT.INVALID_CONFIG, `Diretório de Recreation inválido: ${outputResolution.reason}.`);
    return;
  }
  const recreationRoot = outputResolution.abs;
  const distRoot = path.join(recreationRoot, 'dist');
  const statePath = path.join(recreationRoot, 'recreation-state.json');
  if (!fs.existsSync(statePath) || !fs.existsSync(path.join(distRoot, 'index.html'))) {
    failWith(EXIT.INVALID_CONFIG, 'Recreation não construída. Execute npm ci && npm run build dentro do projeto gerado.');
  }
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));

  const validationDir = path.join(recreationRoot, 'validation');
  ensureDir(validationDir);
  const { server, baseUrl } = await startStaticServer(distRoot);
  const policy = resolveBrowserPolicy(project.config);
  const browser = await chromium.launch({ headless: policy.acquisition.headless });
  const results = [];
  const caseResults = [];
  try {
    for (const scenario of scenariosFor(scope)) {
      results.push(await validateScenario(browser, baseUrl, validationDir, scenario, state.projectCount || 0));
    }
    for (const caseProject of state.cases || []) {
      caseResults.push(await validateCaseRoute(browser, baseUrl, validationDir, caseProject, state.cases));
    }
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }

  const ok = results.every((result) => result.ok) && caseResults.every((result) => result.ok);
  const report = {
    generatedAt: isoNow(),
    acceptanceLevel: ok ? 'LR' : 'LP',
    scopeType: 'declared-recreation-sections',
    completeSite: false,
    declaredSections: state.scope || [],
    projectCount: state.projectCount || 0,
    notImplemented: state.notImplemented || [],
    browser: {
      engine: 'chromium',
      distribution: 'playwright',
      version: browser.version(),
      contextMode: 'clean',
    },
    scenarios: results,
    caseResults,
    ok,
  };
  writeJson(path.join(validationDir, 'recreation-validation.json'), report);
  writeJson(statePath, {
    ...state,
    lastValidationAt: report.generatedAt,
    acceptanceLevel: report.acceptanceLevel,
    validationScope: report.scopeType,
  });

  console.log(`\n[VALIDATE:RECREATION] ${report.acceptanceLevel} — ${results.filter((result) => result.ok).length}/${results.length} cenários aprovados.`);
  if (caseResults.length) {
    console.log(`  Cases: ${caseResults.filter((result) => result.ok).length}/${caseResults.length} rotas /work/:slug aprovadas.`);
  }
  console.log(`  Escopo: ${(report.declaredSections || []).join(', ')}`);
  console.log(`  Site completo: não | Não implementado: ${(report.notImplemented || []).join(', ')}`);
  console.log(`  Relatório: ${path.join(validationDir, 'recreation-validation.json')}`);
  if (!ok) failWith(EXIT.VALIDATION_FAILED, 'A fatia de Editable Recreation não atingiu os gates declarados.');
}

main().catch((error) => failWith(EXIT.INTERNAL_ERROR, `[VALIDATE:RECREATION] Falha fatal: ${error.message}`));
