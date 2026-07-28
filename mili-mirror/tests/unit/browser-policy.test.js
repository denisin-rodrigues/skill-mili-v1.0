import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PASS_DEFINITIONS,
  resolveBrowserPolicy,
  enabledValidationBrowsers,
  decideSecondaryRun,
} from '../../browser/browser-policy.js';

test('defaults: aquisição é Playwright Chromium obrigatória', () => {
  const policy = resolveBrowserPolicy({});
  assert.equal(policy.acquisition.engine, 'chromium');
  assert.equal(policy.acquisition.distribution, 'playwright');
  assert.equal(policy.acquisition.required, true);
  assert.equal(policy.acquisition.useCdp, true);
  assert.equal(policy.acquisition.contextMode, 'clean');
  assert.equal(policy.productionValidation.required, false);
  assert.equal(policy.compatibility.firefox.enabled, false);
  assert.equal(policy.compatibility.webkit.supported, false);
  assert.equal(policy.brave.supportedAsAcquisition, false);
});

test('invariantes NUNCA podem ser alteradas por configuração', () => {
  const malicious = {
    browser: {
      acquisition: { engine: 'firefox', distribution: 'channel', required: false },
      compatibility_validation: { webkit: { enabled: true, required: true, supported: true } },
      brave: { supportedAsAcquisition: true },
    },
  };
  const policy = resolveBrowserPolicy(malicious);
  assert.equal(policy.acquisition.engine, 'chromium', 'engine de aquisição não muda');
  assert.equal(policy.acquisition.distribution, 'playwright', 'distribuição não muda');
  assert.equal(policy.acquisition.required, true, 'aquisição sempre obrigatória');
  assert.equal(policy.compatibility.webkit.supported, false, 'WebKit permanece reservado');
  assert.equal(policy.brave.supportedAsAcquisition, false, 'Brave nunca é aquisição');
});

test('merge de configuração válida', () => {
  const policy = resolveBrowserPolicy({
    browser: {
      acquisition: { headless: false },
      production_validation: { required: true },
      compatibility_validation: { firefox: { enabled: true } },
      passes: { warm_runtime: true },
    },
  });
  assert.equal(policy.acquisition.headless, false);
  assert.equal(policy.productionValidation.required, true);
  assert.equal(policy.compatibility.firefox.enabled, true);
  assert.equal(policy.passes.warmRuntime, true);
});

test('configuração snake_case controla o CDP da aquisição', () => {
  const policy = resolveBrowserPolicy({ browser: { acquisition: { use_cdp: false } } });
  assert.equal(policy.acquisition.useCdp, false);
  assert.equal('use_cdp' in policy.acquisition, false);
});

test('passes modelados: 6 passes, só 2 oficiais de aquisição', () => {
  assert.equal(PASS_DEFINITIONS.length, 6);
  const official = PASS_DEFINITIONS.filter((p) => p.officialAcquisition);
  assert.deepEqual(official.map((p) => p.id), ['chromium-clean-discovery', 'chromium-interaction-discovery']);
  assert.ok(PASS_DEFINITIONS.every((p) => p.description.length > 10));
});

test('enabledValidationBrowsers reflete configuração', () => {
  const policy = resolveBrowserPolicy({ browser: { compatibility_validation: { firefox: { enabled: true, required: true } } } });
  const list = enabledValidationBrowsers(policy);
  const chrome = list.find((b) => b.id === 'chrome-production-validation');
  const firefox = list.find((b) => b.id === 'firefox-compatibility');
  assert.equal(chrome.enabled, true);
  assert.equal(firefox.enabled, true);
  assert.equal(firefox.required, true);
});

test('decideSecondaryRun: matriz de decisão pura', () => {
  assert.equal(decideSecondaryRun({ available: true }, { required: false, enabled: true }), 'run');
  assert.equal(decideSecondaryRun({ available: false }, { required: false, enabled: true }), 'skip');
  assert.equal(decideSecondaryRun({ available: false }, { required: true, enabled: true }), 'fail');
  assert.equal(decideSecondaryRun({ available: true }, { required: false, enabled: false }), 'skip');
  assert.equal(decideSecondaryRun({ available: false }, { required: true, enabled: false }), 'skip', 'desabilitado vence até required');
});

test('Chrome ausente e opcional NÃO quebra a captura (política)', () => {
  const policy = resolveBrowserPolicy({});
  assert.equal(policy.productionValidation.required, false);
  assert.equal(decideSecondaryRun({ available: false, reason: 'not installed' }, { required: policy.productionValidation.required, enabled: true }), 'skip');
});
