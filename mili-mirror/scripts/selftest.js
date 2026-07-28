#!/usr/bin/env node
// End-to-end integration test (Milestone: Robust Asset Resolution and Runtime Rewriting).
// Serves the authorized fixture site as "origin", then runs the full pipeline:
// guardian → capture → rewrite → blueprint → validate (online) → validate (--offline) → report
// plus direct HTTP checks against the local mirror server.
// Usage: npm run selftest
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mimeForPath } from './lib/mime.js';
import { createMirrorServer } from '../server/serve.js';
import { EXIT, failWith } from './lib/exit-codes.js';

const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_SITE = path.join(SKILL_ROOT, 'tests', 'fixture', 'site');
const FIXTURE_PROJECT = path.join(SKILL_ROOT, 'tests', 'fixture', 'project');
const LOG_FILE = path.join(FIXTURE_PROJECT, 'selftest.log');

function serveFixture() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      res.writeHead(400).end('bad');
      return;
    }
    if (pathname.includes('..')) {
      res.writeHead(403).end();
      return;
    }

    // Redirect rule: /old-logo → 302 → /assets/logo.svg
    if (pathname === '/old-logo') {
      res.writeHead(302, { Location: '/assets/logo.svg' }).end();
      return;
    }

    if (pathname === '/') pathname = '/index.html';

    // Query-driven responsive images (como uma CDN de imagens)
    if (pathname === '/assets/responsive.png') {
      const w = url.searchParams.get('w');
      const variant = { '320': 'responsive-320.png', '640': 'responsive-640.png', '1280': 'responsive-1280.png' }[w];
      if (!variant) {
        res.writeHead(404).end('variante desconhecida');
        return;
      }
      pathname = `/assets/${variant}`;
    }

    let abs = path.join(FIXTURE_SITE, pathname);
    if ((!fs.existsSync(abs) || !fs.statSync(abs).isFile()) && !path.extname(pathname)) {
      abs = path.join(FIXTURE_SITE, `${pathname}.html`);
    }
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
      res.writeHead(404).end('nf');
      return;
    }

    const size = fs.statSync(abs).size;
    const headers = { 'Content-Type': mimeForPath(abs), 'Accept-Ranges': 'bytes' };
    const range = req.headers.range ? /^bytes=(\d*)-(\d*)$/.exec(req.headers.range) : null;
    if (range && (range[1] !== '' || range[2] !== '')) {
      let start = range[1] === '' ? null : Number(range[1]);
      let end = range[2] === '' ? null : Number(range[2]);
      if (start === null) {
        start = Math.max(0, size - end);
        end = size - 1;
      } else {
        end = end === null ? size - 1 : Math.min(end, size - 1);
      }
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 });
      fs.createReadStream(abs, { start, end }).pipe(res);
      return;
    }
    res.writeHead(200, { ...headers, 'Content-Length': size });
    fs.createReadStream(abs).pipe(res);
  });
  /** @type {Promise<{server: http.Server, port: number}>} */
  const ready = new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = /** @type {import('node:net').AddressInfo} */ (server.address());
      resolve({ server, port: address.port });
    });
  });
  return ready;
}

function runStep(label, script, scriptArgs) {
  const header = `\n======================================== ${label} ========================================\n`;
  process.stdout.write(header);
  fs.appendFileSync(LOG_FILE, header, 'utf8');
  /** @type {Promise<void>} */
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(SKILL_ROOT, script), ...scriptArgs], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: SKILL_ROOT,
    });
    child.stdout.on('data', (chunk) => {
      process.stdout.write(chunk);
      fs.appendFileSync(LOG_FILE, chunk);
    });
    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk);
      fs.appendFileSync(LOG_FILE, chunk);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} saiu com código ${code}. Ver ${LOG_FILE}`));
    });
  });
}

async function httpChecks() {
  const results = {};
  const contractPath = path.join(FIXTURE_PROJECT, 'capture', 'serving-contract.json');
  const { server, address } = await createMirrorServer({ contractPath, root: FIXTURE_PROJECT, port: 0 });
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const get = async (p, headers = {}) => {
      const res = await fetch(`${base}${p}`, { headers });
      return { status: res.status, body: await res.text(), headers: res.headers };
    };
    results.queryVariants = {
      r320: (await get('/assets/responsive.png?w=320')).body.length,
      r640: (await get('/assets/responsive.png?w=640')).body.length,
      r1280: (await get('/assets/responsive.png?w=1280')).body.length,
    };
    results.undeclaredQuery = (await get('/assets/responsive.png?w=999')).status;
    results.nestedRoute = (await get('/produto/detalhe')).status;
    results.redirectAlias = (await get('/old-logo')).status;
    results.videoRange = (await get('/assets/intro.mp4?v=hd', { Range: 'bytes=0-99' })).status;
    results.encodedUrl = (await get('/assets/espa%C3%A7o.png')).status;
    results.specialChars = (await get(`/assets/${encodeURIComponent('relatório(2026).svg')}`)).status;
    results.missing = (await get('/arquivo-que-nao-existe.png')).status;
  } finally {
    server.close();
  }
  return results;
}

async function main() {
  // V-07: clean generated outputs so stale files can never mask missing-file failures
  for (const rel of ['capture', 'mirror', 'experience-blueprint']) {
    fs.rmSync(path.join(FIXTURE_PROJECT, rel), { recursive: true, force: true });
  }
  for (const rel of ['scope.lock.json', 'authorization.hash', 'REPORT.md', 'KNOWN-GAPS.md', 'DEPENDENCIES.md', 'AUTHORIZATION-SUMMARY.md', 'LAUNCH.md']) {
    fs.rmSync(path.join(FIXTURE_PROJECT, rel), { force: true });
  }

  const { server, port } = await serveFixture();
  const origin = `http://127.0.0.1:${port}`;
  fs.mkdirSync(FIXTURE_PROJECT, { recursive: true });
  fs.writeFileSync(LOG_FILE, `[SELFTEST] Origem fixture em ${origin}\n`, 'utf8');
  console.log(`[SELFTEST] Origem fixture em ${origin}`);

  const configPath = path.join(FIXTURE_PROJECT, 'mirror.config.yaml');
  const authPath = path.join(FIXTURE_PROJECT, 'authorization.yaml');

  fs.writeFileSync(
    configPath,
    `config_version: 1

project:
  name: fixture-selftest
  output_dir: .

target:
  type: local-controlled-fixture
  fixture_id: robust-assets-fixture

source:
  url: ${origin}
  authorized_domains:
    - 127.0.0.1

mode:
  preferred: static-mirror
  fallback: editable-recreation

routes:
  include:
    - /
    - /sobre
    - /produto/detalhe
  exclude: []

viewports:
  - name: desktop
    width: 1440
    height: 900
  - name: mobile
    width: 390
    height: 844

capture:
  lazy_assets: true
  media: true
  max_depth: 3
  rate_limit_requests_per_second: 40
  max_total_download_gb: 1

interactions:
  scroll: true
  hover: false
  click_safe_elements: false
  forms: disabled
  media_playback: false

validation:
  visual: true
  network: true
  console: true
  responsive: true
  offline: true
`,
    'utf8',
  );

  fs.writeFileSync(
    authPath,
    `project_name: fixture-selftest
authorization_type: local-self-declared

source:
  primary_domain: 127.0.0.1

authorized_domains:
  - 127.0.0.1

authorized_routes:
  - "*"

authorized_actions:
  static_asset_capture: true
  route_capture: true
  interaction_capture: true
  authenticated_capture: false
  third_party_assets: false

authorized_by:
  name: Self Test
  role: Automação local (DV-004)
  company: nt-site-mirror
  email: selftest@localhost

valid_from: 2026-01-01
valid_until: 2027-12-31
`,
    'utf8',
  );

  try {
    await runStep('GUARDIAN', 'scripts/guardian.js', ['--config', configPath, '--authorization', authPath]);
    await runStep('CAPTURE', 'scripts/capture.js', ['--config', configPath]);
    await runStep('REWRITE', 'scripts/rewrite.js', ['--config', configPath]);
    await runStep('BLUEPRINT', 'scripts/blueprint.js', ['--config', configPath]);
    await runStep('VALIDATE', 'scripts/validate.js', ['--config', configPath]);
    await runStep('VALIDATE OFFLINE', 'scripts/validate.js', ['--config', configPath, '--offline']);
    await runStep('REPORT', 'scripts/report.js', ['--config', configPath]);
  } finally {
    server.close();
  }

  // ---- Assertions ----
  const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(FIXTURE_PROJECT, rel), 'utf8'));
  const manifest = readJson('capture/manifest.json');
  const validation = readJson('capture/validation-results.json');
  const contract = readJson('capture/serving-contract.json');
  const rewriteReport = readJson('capture/rewrite-report.json');
  const records = fs
    .readFileSync(path.join(FIXTURE_PROJECT, 'capture', 'acquisition-records.jsonl'), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));

  const http = await httpChecks();
  console.log('\n[SELFTEST] Verificações HTTP diretas:', JSON.stringify(http));

  const responsiveAssets = contract.assets.filter((a) => a.requestPath === '/assets/responsive.png');
  const responsiveFiles = responsiveAssets.map((a) => a.file);
  const responsiveHashes = new Set(
    responsiveFiles.map((f) => {
      const abs = path.join(FIXTURE_PROJECT, f);
      return fs.existsSync(abs) ? fs.readFileSync(abs).length : -1;
    }),
  );
  const pageHtml = fs.readFileSync(path.join(FIXTURE_PROJECT, 'mirror', 'pages', 'index.html'), 'utf8');
  const localCss = fs.readFileSync(path.join(FIXTURE_PROJECT, 'mirror', 'assets', '127.0.0.1', 'assets', 'style.css'), 'utf8');
  const localMainJs = fs.readFileSync(path.join(FIXTURE_PROJECT, 'mirror', 'assets', '127.0.0.1', 'assets', 'js', 'main.js'), 'utf8');
  const videoRecord = records.find((r) => r.kind === 'video');
  const jsEvidence = rewriteReport.entries.filter((e) => e.referenceType.startsWith('js:'));
  const requiredEntryFields = ['sourceFile', 'originalUrl', 'originalValue', 'rewrittenValue', 'referenceType', 'strategy', 'confidence', 'status'];

  const checks = [
    ['Autorização aprovada (scope.lock)', fs.existsSync(path.join(FIXTURE_PROJECT, 'scope.lock.json'))],
    ['Rede capturada por rota (inclui aninhada)', records.some((r) => r.routeDiscovered === '/produto/detalhe')],
    ['Asset tardio (lazy.svg?v=2) descoberto', records.some((r) => r.sourceUrl.includes('lazy.svg'))],
    ['Assets com sha256', records.filter((r) => r.classification === 'captured').every((r) => typeof r.sha256 === 'string' && r.sha256.length === 64)],
    ['Externo bloqueado pela allowlist', manifest.resourcesBlocked >= 1],
    ['Vídeo capturado via download direto, corpo completo', videoRecord?.acquisitionMethod === 'direct-download' && videoRecord.sizeBytes > 1000],
    ['Byte-range 206 no vídeo com query', validation.byteRange?.ok === true && validation.byteRange.asset.includes('intro.mp4')],
    ['Desktop + mobile validados', new Set(validation.routes.map((r) => r.viewport)).size === 2],
    ['Console registrado', fs.existsSync(path.join(FIXTURE_PROJECT, 'capture', 'logs', 'console-index-desktop.json'))],
    ['Validação offline executada', validation.offline === true],
    ['Nenhum arquivo crítico 404 na validação', validation.totals.missingFiles === 0 && validation.totals.localFailures === 0],
    ['Blueprint inicial gerado', fs.existsSync(path.join(FIXTURE_PROJECT, 'experience-blueprint', 'pages.json'))],
    ['Relatório gerado', fs.existsSync(path.join(FIXTURE_PROJECT, 'REPORT.md'))],
    ['Headers sensíveis mascarados', !records.some((r) => JSON.stringify(r.headers || {}).toLowerCase().includes('cookie:'))],
    ['Resultado classificado L4', validation.classification.acceptanceLevel === 'L4'],
    ['Classificação limitada ao fixture declarado', validation.classification.validationTarget === 'local-controlled-fixture' && validation.classification.fixtureId === 'robust-assets-fixture'],
    ['Capabilities exercitadas/não exercitadas registradas', Array.isArray(validation.classification.capabilitiesExercised) && validation.classification.capabilitiesNotExercised.includes('service-worker')],
    ['Manifest carrega validationTarget + fixtureId', manifest.validationTarget === 'local-controlled-fixture' && manifest.fixtureId === 'robust-assets-fixture'],
    ['Contrato v2 com 3 rotas', contract.version === 2 && contract.routes.length === 3],
    ['Query variants: 3 registros distintos para responsive.png', responsiveAssets.length === 3 && new Set(responsiveFiles).size === 3],
    ['Query variants: conteúdos distintos por query', responsiveHashes.size === 3 && !responsiveHashes.has(-1)],
    ['Redirect alias (/old-logo) no contrato', contract.assets.some((a) => a.requestPath === '/old-logo' && a.viaRedirect === true)],
    ['rewrite-report.json gerado com entradas completas', rewriteReport.entries.length > 0 && rewriteReport.entries.every((e) => requiredEntryFields.every((f) => f in e) && 'reason' in e)],
    ['Toda alteração JS possui evidência', jsEvidence.length > 0 && jsEvidence.every((e) => e.status !== 'rewritten' || (e.rewrittenValue && e.originalValue))],
    ['HTML: srcset e fragment reescritos para /__assets/', pageHtml.includes('/__assets/') && pageHtml.includes('#icon-star')],
    ['HTML: form neutralizado', pageHtml.includes('action="#"') && pageHtml.includes('data-original-action="/pesquisar"')],
    ['CSS: @import reescrito', localCss.includes('/__assets/127.0.0.1/assets/imported.css')],
    ['JS: worker reescrito', localMainJs.includes('/__assets/127.0.0.1/assets/js/worker.js')],
    ['HTTP: queries diferentes → arquivos diferentes', new Set(Object.values(http.queryVariants)).size === 3],
    ['HTTP: query não declarada → 404', http.undeclaredQuery === 404],
    ['HTTP: rota aninhada 200', http.nestedRoute === 200],
    ['HTTP: alias de redirect 200', http.redirectAlias === 200],
    ['HTTP: vídeo com query → 206', http.videoRange === 206],
    ['HTTP: URL codificada 200', http.encodedUrl === 200],
    ['HTTP: caracteres especiais 200', http.specialChars === 200],
    ['HTTP: ausente → 404 real', http.missing === 404],
  ];

  console.log('\n======================================== RESULTADO ========================================');
  let failed = 0;
  for (const [label, ok] of checks) {
    if (!ok) failed += 1;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`);
  }
  console.log(`\nClassificação final do fixture: ${validation.classification.acceptanceLevel} (${validation.classification.validationTarget})`);
  console.log(`Rewrite: ${rewriteReport.stats.rewritten} reescritas | ${rewriteReport.stats.skipped} não reescritas | ${rewriteReport.stats.failed} falhas`);
  if (failed > 0) {
    failWith(EXIT.VALIDATION_FAILED, `${failed} verificações falharam.`);
  }
  console.log('\n[SELFTEST] Todas as verificações passaram.');
}

main().catch((err) => {
  failWith(EXIT.INTERNAL_ERROR, `[SELFTEST] Falha fatal: ${err.message}`);
});
