#!/usr/bin/env node
// End-to-end self-test: serves the fixture site as "origin", then runs the full
// pipeline (guardian → capture → blueprint → validate → validate --offline → report)
// against localhost (allowed via DV-004, local-self-declared).
// Usage: npm run selftest
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mimeForPath } from './lib/mime.js';

const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_SITE = path.join(SKILL_ROOT, 'tests', 'fixture', 'site');
const FIXTURE_PROJECT = path.join(SKILL_ROOT, 'tests', 'fixture', 'project');
const LOG_FILE = path.join(FIXTURE_PROJECT, 'selftest.log');

function serveFixture() {
  const server = http.createServer((req, res) => {
    let pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (pathname === '/') pathname = '/index.html';
    if (pathname.includes('..')) {
      res.writeHead(403).end();
      return;
    }
    let abs = path.join(FIXTURE_SITE, pathname);
    if ((!fs.existsSync(abs) || !fs.statSync(abs).isFile()) && !path.extname(pathname)) {
      abs = path.join(FIXTURE_SITE, `${pathname}.html`);
    }
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
      res.writeHead(404).end('nf');
      return;
    }
    res.writeHead(200, { 'Content-Type': mimeForPath(abs) });
    fs.createReadStream(abs).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

function runStep(label, script, scriptArgs) {
  const header = `\n======================================== ${label} ========================================\n`;
  process.stdout.write(header);
  fs.appendFileSync(LOG_FILE, header, 'utf8');
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

async function main() {
  const { server, port } = await serveFixture();
  const origin = `http://127.0.0.1:${port}`;
  fs.mkdirSync(FIXTURE_PROJECT, { recursive: true });
  fs.writeFileSync(LOG_FILE, `[SELFTEST] Origem fixture em ${origin}\n`, 'utf8');
  console.log(`[SELFTEST] Origem fixture em ${origin}`);
  const configPath = path.join(FIXTURE_PROJECT, 'mirror.config.yaml');
  const authPath = path.join(FIXTURE_PROJECT, 'authorization.yaml');

  fs.writeFileSync(
    configPath,
    `project:
  name: fixture-selftest
  output_dir: .

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

  const cfg = `--config`;
  const configArg = configPath;
  try {
    await runStep('GUARDIAN', 'scripts/guardian.js', [cfg, configArg, '--authorization', authPath]);
    await runStep('CAPTURE', 'scripts/capture.js', [cfg, configArg]);
    await runStep('BLUEPRINT', 'scripts/blueprint.js', [cfg, configArg]);
    await runStep('VALIDATE', 'scripts/validate.js', [cfg, configArg]);
    await runStep('VALIDATE OFFLINE', 'scripts/validate.js', [cfg, configArg, '--offline']);
    await runStep('REPORT', 'scripts/report.js', [cfg, configArg]);
  } finally {
    server.close();
  }

  // Assertions
  const manifest = JSON.parse(fs.readFileSync(path.join(FIXTURE_PROJECT, 'capture', 'manifest.json'), 'utf8'));
  const validation = JSON.parse(fs.readFileSync(path.join(FIXTURE_PROJECT, 'capture', 'validation-results.json'), 'utf8'));
  const contract = JSON.parse(fs.readFileSync(path.join(FIXTURE_PROJECT, 'capture', 'serving-contract.json'), 'utf8'));
  const records = fs
    .readFileSync(path.join(FIXTURE_PROJECT, 'capture', 'acquisition-records.jsonl'), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));

  const checks = [
    ['MVP-001 autorização aprovada', fs.existsSync(path.join(FIXTURE_PROJECT, 'scope.lock.json'))],
    ['MVP-004 rede capturada por rota', records.some((r) => r.routeDiscovered === '/sobre')],
    ['MVP-005 asset tardio (lazy.svg) descoberto', records.some((r) => r.sourceUrl.includes('lazy.svg'))],
    ['MVP-006 assets com sha256', records.every((r) => typeof r.sha256 === 'string' && r.sha256.length === 64)],
    ['MVP-015 externo bloqueado pela allowlist', manifest.resourcesBlocked >= 1],
    ['MVP-009 byte-range 206', validation.byteRange?.ok === true],
    ['MVP-010 desktop + mobile validados', new Set(validation.routes.map((r) => r.viewport)).size === 2],
    ['MVP-011 console registrado', fs.existsSync(path.join(FIXTURE_PROJECT, 'capture', 'logs', 'console-index-desktop.json'))],
    ['MVP-012 validação offline executada', validation.offline === true],
    ['MVP-013 blueprint inicial gerado', fs.existsSync(path.join(FIXTURE_PROJECT, 'experience-blueprint', 'pages.json'))],
    ['MVP-014 relatório gerado', fs.existsSync(path.join(FIXTURE_PROJECT, 'REPORT.md'))],
    ['MVP-016 headers sensíveis mascarados', !records.some((r) => JSON.stringify(r.headers || {}).toLowerCase().includes('cookie:'))],
    ['MVP-017 resultado classificado', ['L2', 'L3', 'L4'].includes(validation.classification.level)],
    ['Contrato com rotas / e /sobre', contract.routes.length === 2],
    ['Lazy asset no contrato de serving', Object.keys(contract.assets).some((p) => p.includes('lazy.svg'))],
  ];

  console.log('\n======================================== RESULTADO ========================================');
  let failed = 0;
  for (const [label, ok] of checks) {
    if (!ok) failed += 1;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`);
  }
  console.log(`\nClassificação final do fixture: ${validation.classification.level}`);
  if (failed > 0) {
    console.error(`\n[SELFTEST] ${failed} verificações falharam.`);
    process.exit(1);
  }
  console.log('\n[SELFTEST] Todas as verificações passaram.');
}

main().catch((err) => {
  console.error(`\n[SELFTEST] Falha fatal: ${err.message}`);
  process.exit(1);
});
