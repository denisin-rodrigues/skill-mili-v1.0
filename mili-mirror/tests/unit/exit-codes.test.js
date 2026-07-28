// Exit code contract: every CLI returns the centralized code and a registered cause.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXIT } from '../../scripts/lib/exit-codes.js';

const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function run(script, args, cwd) {
  const r = spawnSync(process.execPath, [path.join(SKILL_ROOT, script), ...args], {
    cwd: cwd || SKILL_ROOT,
    encoding: 'utf8',
    timeout: 60000,
  });
  return { code: r.status, out: `${r.stdout}\n${r.stderr}` };
}

function makeTmpProject({ configYaml = null, scopeLock = null } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ntm-exit-'));
  if (configYaml !== null) fs.writeFileSync(path.join(dir, 'mirror.config.yaml'), configYaml);
  if (scopeLock) fs.writeFileSync(path.join(dir, 'scope.lock.json'), JSON.stringify(scopeLock));
  return dir;
}

const BASE_CONFIG = `config_version: 1
project:
  name: exit-test
  output_dir: .
source:
  url: http://127.0.0.1:9
  authorized_domains:
    - 127.0.0.1
routes:
  include:
    - /
viewports:
  - name: desktop
    width: 1440
    height: 900
`;

const APPROVED_SCOPE = {
  projectId: 'exit-test',
  status: 'approved',
  domains: ['127.0.0.1'],
  routes: { include: ['/'], exclude: [] },
  viewports: [{ name: 'desktop', width: 1440, height: 900 }],
  source: { url: 'http://127.0.0.1:9', primaryDomain: '127.0.0.1' },
};

test('enum existe e é estável (contrato público)', () => {
  assert.equal(EXIT.SUCCESS, 0);
  assert.equal(EXIT.INVALID_CONFIG, 2);
  assert.equal(EXIT.AUTHORIZATION_DENIED, 3);
  assert.equal(EXIT.DOMAIN_BLOCKED, 4);
  assert.equal(EXIT.CAPTURE_FAILED, 5);
  assert.equal(EXIT.VALIDATION_FAILED, 6);
  assert.equal(EXIT.DEPENDENCY_MISSING, 7);
  assert.equal(EXIT.INTERNAL_ERROR, 8);
  assert.equal(EXIT.PARTIAL_RESULT, 9);
});

test('guardian: domínio fora da autorização → 4 (DOMAIN_BLOCKED) com causa', () => {
  // Domínio NÃO-local: localhost é autodeclaração (DV-004) e pula checagem por design
  const nonLocalConfig = BASE_CONFIG.replace('http://127.0.0.1:9', 'https://nao-autorizado.com').replace('- 127.0.0.1', '- nao-autorizado.com');
  const dir = makeTmpProject({ configYaml: nonLocalConfig });
  fs.writeFileSync(
    path.join(dir, 'authorization.yaml'),
    `authorization_type: client-approved
source:
  primary_domain: outro.com
authorized_domains:
  - outro.com
authorized_routes:
  - "/"
authorized_actions:
  static_asset_capture: true
valid_until: 2099-01-01
`,
  );
  const r = run('scripts/guardian.js', ['--config', 'mirror.config.yaml', '--authorization', 'authorization.yaml'], dir);
  assert.equal(r.code, EXIT.DOMAIN_BLOCKED);
  assert.match(r.out, /NEGADA/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('guardian: autorização expirada → 3 (AUTHORIZATION_DENIED)', () => {
  const dir = makeTmpProject({ configYaml: BASE_CONFIG });
  fs.writeFileSync(
    path.join(dir, 'authorization.yaml'),
    `authorization_type: local-self-declared
source:
  primary_domain: 127.0.0.1
authorized_domains:
  - 127.0.0.1
authorized_routes:
  - "*"
authorized_actions:
  static_asset_capture: true
valid_until: 2020-01-01
`,
  );
  const r = run('scripts/guardian.js', ['--config', 'mirror.config.yaml', '--authorization', 'authorization.yaml'], dir);
  assert.equal(r.code, EXIT.AUTHORIZATION_DENIED);
  assert.match(r.out, /expirada/i);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('guardian: config inválida (sem source) → 2 (INVALID_CONFIG) com causa', () => {
  const dir = makeTmpProject({ configYaml: 'project:\n  name: x\n  output_dir: .\n' });
  const r = run('scripts/guardian.js', ['--config', 'mirror.config.yaml', '--authorization', 'x.yaml'], dir);
  assert.equal(r.code, EXIT.INVALID_CONFIG);
  assert.match(r.out, /mirror\.config\.yaml|source/i);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('guardian: config inexistente → 2 (INVALID_CONFIG)', () => {
  const dir = makeTmpProject({ configYaml: null });
  const r = run('scripts/guardian.js', ['--config', 'mirror.config.yaml', '--authorization', 'x.yaml'], dir);
  assert.equal(r.code, EXIT.INVALID_CONFIG);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('guardian: output_dir escapando da raiz → 2 (INVALID_CONFIG)', () => {
  const dir = makeTmpProject({ configYaml: BASE_CONFIG.replace('output_dir: .', 'output_dir: ../evil') });
  const r = run('scripts/guardian.js', ['--config', 'mirror.config.yaml', '--authorization', 'x.yaml'], dir);
  assert.equal(r.code, EXIT.INVALID_CONFIG);
  assert.match(r.out, /escapa da raiz/i);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('capture: sem scope.lock → 3 (AUTHORIZATION_DENIED)', () => {
  const dir = makeTmpProject({ configYaml: BASE_CONFIG });
  const r = run('scripts/capture.js', ['--config', 'mirror.config.yaml'], dir);
  assert.equal(r.code, EXIT.AUTHORIZATION_DENIED);
  assert.match(r.out, /scope\.lock/i);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('rewrite: sem registros de captura → 2 (INVALID_CONFIG)', () => {
  const dir = makeTmpProject({ configYaml: BASE_CONFIG, scopeLock: APPROVED_SCOPE });
  const r = run('scripts/rewrite.js', ['--config', 'mirror.config.yaml'], dir);
  assert.equal(r.code, EXIT.INVALID_CONFIG);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('rewrite: JS com erro de parse → 9 (PARTIAL_RESULT) + evidência', () => {
  const dir = makeTmpProject({ configYaml: BASE_CONFIG, scopeLock: APPROVED_SCOPE });
  fs.mkdirSync(path.join(dir, 'capture'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'mirror', 'assets', 'h'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'mirror', 'assets', 'h', 'bad.js'), 'const = {{{ quebrado');
  fs.writeFileSync(
    path.join(dir, 'capture', 'acquisition-records.jsonl'),
    `${JSON.stringify({
      sourceUrl: 'http://127.0.0.1:9/bad.js',
      canonical: 'http://127.0.0.1:9/bad.js',
      localPath: 'mirror/assets/h/bad.js',
      kind: 'js',
      classification: 'captured',
    })}\n`,
  );
  fs.writeFileSync(path.join(dir, 'capture', 'pages-meta.json'), '[]');
  const r = run('scripts/rewrite.js', ['--config', 'mirror.config.yaml'], dir);
  assert.equal(r.code, EXIT.PARTIAL_RESULT);
  const report = JSON.parse(fs.readFileSync(path.join(dir, 'capture', 'rewrite-report.json'), 'utf8'));
  assert.equal(report.stats.failed >= 1, true);
  assert.ok(report.entries.some((e) => e.status === 'failed' && /parse-error/.test(e.reason)));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('validate: sem serving-contract → 2 (INVALID_CONFIG)', () => {
  const dir = makeTmpProject({ configYaml: BASE_CONFIG, scopeLock: APPROVED_SCOPE });
  const r = run('scripts/validate.js', ['--config', 'mirror.config.yaml'], dir);
  assert.equal(r.code, EXIT.INVALID_CONFIG);
  assert.match(r.out, /serving-contract/i);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('serve: contrato inexistente → 2 (INVALID_CONFIG)', () => {
  const dir = makeTmpProject({});
  const r = run('server/serve.js', ['--contract', 'capture/serving-contract.json', '--port', '0'], dir);
  assert.equal(r.code, EXIT.INVALID_CONFIG);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('serve: contrato com versão incompatível → 2 (INVALID_CONFIG) com causa', () => {
  const dir = makeTmpProject({});
  fs.mkdirSync(path.join(dir, 'capture'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'capture', 'serving-contract.json'),
    JSON.stringify({ version: 1, host: '127.0.0.1', port: 4173, routes: [], assets: [], querySensitiveAssets: true, byteRangeSupport: true, spaFallback: false }),
  );
  const r = run('server/serve.js', ['--contract', 'capture/serving-contract.json', '--port', '0'], dir);
  assert.equal(r.code, EXIT.INVALID_CONFIG);
  assert.match(r.out, /serving-contract|version/i);
  fs.rmSync(dir, { recursive: true, force: true });
});
