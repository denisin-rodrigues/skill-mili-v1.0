// V-02 regression: ordinal level comparison + external degradation policy (ADR-002).
// The old code compared levels as strings ('LP' >= 'L2' is TRUE lexicographically —
// a partial result would have passed the L4 gate). These tests fail on that behavior.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LEVEL_ORDER,
  levelAtLeast,
  classifyExternalAttempt,
  computeAcceptance,
  buildClassification,
  acceptanceSentence,
} from '../../scripts/lib/acceptance.js';

test('V-02: comparação ordinal, nunca lexicográfica', () => {
  // Na comparação de strings antiga, 'LP' >= 'L2' era true (falso positivo para parcial)
  assert.equal('LP' >= 'L2', true, 'prova de que a comparação antiga era quebrada');
  assert.equal(levelAtLeast('LP', 'L2'), false, 'LP não pode passar no gate L4');
  assert.equal(levelAtLeast('L3', 'L2'), true);
  assert.equal(levelAtLeast('L4', 'L2'), true);
  assert.equal(levelAtLeast('L1', 'L2'), false);
  assert.equal(levelAtLeast('L0', 'L2'), false);
  // entradas malformadas nunca passam
  assert.equal(levelAtLeast('L10', 'L2'), false);
  assert.equal(levelAtLeast('', 'L2'), false);
  assert.equal(levelAtLeast('L2', 'XX'), false);
  assert.equal(LEVEL_ORDER.L0 < LEVEL_ORDER.LR, true);
});

const OK_TOTALS = { routesOk: 3, consoleErrors: 0, pageErrors: 0, localFailures: 0, missingFiles: 0 };

test('computeAcceptance: online limpo → L3', () => {
  const r = computeAcceptance({ offline: false, allRoutes200: true, totals: OK_TOTALS, externalAttempts: [], interactionsNotExercised: [] });
  assert.equal(r.level, 'L3');
});

test('computeAcceptance: offline limpo → L4 (só com evidência completa)', () => {
  const r = computeAcceptance({ offline: true, allRoutes200: true, totals: OK_TOTALS, externalAttempts: [], interactionsNotExercised: [] });
  assert.equal(r.level, 'L4');
});

test('degradação externa: tentativa CRÍTICA offline bloqueia L4', () => {
  const r = computeAcceptance({
    offline: true,
    allRoutes200: true,
    totals: OK_TOTALS,
    externalAttempts: [{ url: 'https://cdn.x.com/app.js', resourceType: 'script' }],
    interactionsNotExercised: [],
  });
  assert.notEqual(r.level, 'L4');
  assert.equal(r.level, 'L3');
  assert.ok(r.reasons.join(' ').includes('CRÍTICA'));
  assert.equal(r.criticalAttempts.length, 1);
});

test('degradação externa: tentativa opcional offline mantém L4 e registra', () => {
  const r = computeAcceptance({
    offline: true,
    allRoutes200: true,
    totals: OK_TOTALS,
    externalAttempts: [{ url: 'https://cdn.x.com/pixel.png', resourceType: 'image' }],
    interactionsNotExercised: [],
  });
  assert.equal(r.level, 'L4');
  assert.equal(r.optionalAttempts.length, 1);
});

test('interação declarada não exercitada bloqueia L4', () => {
  const r = computeAcceptance({
    offline: true,
    allRoutes200: true,
    totals: OK_TOTALS,
    externalAttempts: [],
    interactionsNotExercised: ['hover'],
  });
  assert.notEqual(r.level, 'L4');
  assert.ok(r.reasons.join(' ').includes('não exercitadas'));
});

test('L0 sem rotas, L1 com ausências, L2 com erros de console', () => {
  assert.equal(computeAcceptance({ offline: false, allRoutes200: false, totals: { ...OK_TOTALS, routesOk: 0 }, externalAttempts: [], interactionsNotExercised: [] }).level, 'L0');
  assert.equal(computeAcceptance({ offline: false, allRoutes200: false, totals: { ...OK_TOTALS, missingFiles: 2 }, externalAttempts: [], interactionsNotExercised: [] }).level, 'L1');
  assert.equal(computeAcceptance({ offline: false, allRoutes200: true, totals: { ...OK_TOTALS, consoleErrors: 1 }, externalAttempts: [], interactionsNotExercised: [] }).level, 'L2');
});

test('offline abaixo de L2 nunca vira L4', () => {
  const r = computeAcceptance({ offline: true, allRoutes200: false, totals: { ...OK_TOTALS, missingFiles: 1 }, externalAttempts: [], interactionsNotExercised: [] });
  assert.equal(r.level, 'L1');
  assert.ok(r.reasons.join(' ').includes('L4 bloqueado'));
});

test('classifyExternalAttempt: tipos críticos vs opcionais', () => {
  assert.equal(classifyExternalAttempt({ url: 'u', resourceType: 'script' }), 'critical');
  assert.equal(classifyExternalAttempt({ url: 'u', resourceType: 'stylesheet' }), 'critical');
  assert.equal(classifyExternalAttempt({ url: 'u', resourceType: 'xhr' }), 'critical');
  assert.equal(classifyExternalAttempt({ url: 'u', resourceType: 'image' }), 'optional');
  assert.equal(classifyExternalAttempt({ url: 'u', resourceType: 'font' }), 'optional');
  assert.equal(classifyExternalAttempt({ url: 'u' }), 'optional');
});

test('classificação é limitada ao fixture/escopo — nunca universal', () => {
  const fixture = buildClassification({
    config: { target: { type: 'local-controlled-fixture', fixture_id: 'robust-assets-fixture' } },
    scope: { routes: { include: ['/'] }, viewports: [{ name: 'desktop' }, { name: 'mobile' }] },
    level: 'L4',
    reasons: [],
    criticalAttempts: [],
    optionalAttempts: [],
    interactionsNotExercised: [],
    knownLimitations: [],
  });
  assert.equal(fixture.validationTarget, 'local-controlled-fixture');
  assert.equal(fixture.fixtureId, 'robust-assets-fixture');
  assert.equal(fixture.acceptanceLevel, 'L4');
  assert.equal(fixture.confidence, 'high');
  assert.ok(fixture.capabilitiesExercised.includes('offline'));
  assert.ok(fixture.capabilitiesNotExercised.includes('service-worker'));

  const sentence = acceptanceSentence(fixture);
  assert.match(sentence, /validado para o escopo e fixture declarados/);
  assert.doesNotMatch(sentence, /qualquer site/i);

  const site = buildClassification({
    config: {},
    scope: { routes: { include: ['/'] }, viewports: [{ name: 'desktop' }] },
    level: 'L2',
    reasons: [],
    criticalAttempts: [],
    optionalAttempts: [],
    interactionsNotExercised: [],
    knownLimitations: [],
  });
  assert.equal(site.validationTarget, 'authorized-site');
  assert.equal(site.fixtureId, null);
  assert.match(acceptanceSentence(site), /validado para o escopo declarado/);
});
