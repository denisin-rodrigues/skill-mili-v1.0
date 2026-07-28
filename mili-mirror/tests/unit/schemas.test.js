import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateMirrorConfig, validateServingContract, validateManifest, formatValidationErrors } from '../../validators/index.js';

const VALID_CONFIG = {
  config_version: 1,
  project: { name: 'p', output_dir: '.' },
  target: { type: 'local-controlled-fixture', fixture_id: 'f' },
  source: { url: 'http://127.0.0.1:8000', authorized_domains: ['127.0.0.1'] },
  routes: { include: ['/'], exclude: [] },
  viewports: [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ],
  capture: { rate_limit_requests_per_second: 4, max_total_download_gb: 1 },
  interactions: { scroll: true, forms: 'disabled' },
};

const VALID_CONTRACT = {
  version: 2,
  host: '127.0.0.1',
  port: 4173,
  routes: [{ requestPath: '/', file: 'mirror/pages/index.html', contentType: 'text/html' }],
  assets: [{ requestPath: '/a.png', requestQuery: 'w=1', file: 'mirror/assets/h/a.png', contentType: 'image/png', kind: 'image' }],
  querySensitiveAssets: true,
  byteRangeSupport: true,
  spaFallback: false,
  notes: [],
};

const VALID_MANIFEST = {
  captureId: 'cap_1',
  projectId: 'p',
  startedAt: '2026-07-24T10:00:00.000Z',
  source: 'http://127.0.0.1:8000',
  authorizationHash: `sha256:${'a'.repeat(64)}`,
  toolVersion: '1.0.0',
  browser: { name: 'chromium', version: '149' },
  routesDeclared: 1,
  routesExercised: 1,
  requestsObserved: 10,
  resourcesLocal: 8,
  resourcesBlocked: 1,
  resourcesFailed: 0,
  acceptanceLevel: 'pending-validation',
};

test('mirror-config: documento válido passa', () => {
  const r = validateMirrorConfig(VALID_CONFIG);
  assert.equal(r.valid, true, JSON.stringify(r.errors));
});

test('mirror-config: campo obrigatório ausente falha com mensagem clara', () => {
  const doc = { ...VALID_CONFIG };
  delete doc.source;
  const r = validateMirrorConfig(doc);
  assert.equal(r.valid, false);
  assert.ok(formatValidationErrors('mirror.config.yaml', r.errors).includes('source'));
});

test('mirror-config: tipo incorreto falha', () => {
  const r = validateMirrorConfig({ ...VALID_CONFIG, viewports: 'desktop' });
  assert.equal(r.valid, false);
  const r2 = validateMirrorConfig({ ...VALID_CONFIG, viewports: [{ name: 'x', width: 'largo', height: 900 }] });
  assert.equal(r2.valid, false);
});

test('mirror-config: campo desconhecido é PERMITIDO (política documentada)', () => {
  const r = validateMirrorConfig({ ...VALID_CONFIG, campo_futuro: { a: 1 } });
  assert.equal(r.valid, true);
});

test('mirror-config: versão incompatível falha', () => {
  const r = validateMirrorConfig({ ...VALID_CONFIG, config_version: 99 });
  assert.equal(r.valid, false);
});

test('serving-contract: v2 válido passa; versão incompatível falha', () => {
  assert.equal(validateServingContract(VALID_CONTRACT).valid, true);
  assert.equal(validateServingContract({ ...VALID_CONTRACT, version: 1 }).valid, false);
});

test('serving-contract: formato v1 (assets como objeto) é rejeitado', () => {
  const v1 = { ...VALID_CONTRACT, assets: { '/a.png': 'mirror/assets/h/a.png' } };
  assert.equal(validateServingContract(v1).valid, false);
});

test('serving-contract: campo desconhecido é REJEITADO (contrato interno estrito)', () => {
  assert.equal(validateServingContract({ ...VALID_CONTRACT, surpresa: 1 }).valid, false);
});

test('manifest: válido passa; hash malformado falha', () => {
  assert.equal(validateManifest(VALID_MANIFEST).valid, true);
  assert.equal(validateManifest({ ...VALID_MANIFEST, authorizationHash: 'sha256:xyz' }).valid, false);
  assert.equal(validateManifest({ ...VALID_MANIFEST, acceptanceLevel: 'L99' }).valid, false);
});
