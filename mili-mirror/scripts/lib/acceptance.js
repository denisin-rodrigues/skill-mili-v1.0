// Acceptance level computation (Milestone: Core Hardening).
// Fixes V-02 (fragile string comparison) with an explicit ordinal scale, applies
// the external-degradation policy for L4 (ADR-002) and produces fixture-scoped
// classification metadata. L4 is always limited to the exercised scope — never
// a claim about arbitrary websites.

/**
 * Ordinal acceptance scale (V-02 fix). Do NOT compare levels as strings:
 * lexicographic order breaks as soon as the enum grows (e.g. 'L10' < 'L2').
 */
export const LEVEL_ORDER = Object.freeze({
  L0: 0,
  L1: 1,
  LP: 2,
  L2: 3,
  L3: 4,
  L4: 5,
  LR: 6,
});

/**
 * @param {string} level
 * @param {string} minimum
 * @returns {boolean}
 */
export function levelAtLeast(level, minimum) {
  const a = LEVEL_ORDER[level];
  const b = LEVEL_ORDER[minimum];
  if (a === undefined || b === undefined) return false;
  return a >= b;
}

/**
 * Resource types whose absence can break the page (critical external dependencies).
 * Anything not listed is treated as optional (image, media, font, ping, beacon, ...).
 * See docs/adr/ADR-002-l4-external-degradation.md
 */
export const CRITICAL_RESOURCE_TYPES = new Set([
  'document',
  'stylesheet',
  'script',
  'xhr',
  'fetch',
  'worker',
  'shared_worker',
  'websocket',
]);

/**
 * Classifies an external attempt observed during offline validation.
 * @param {{url:string, resourceType?:string}} attempt
 * @returns {'critical'|'optional'}
 */
export function classifyExternalAttempt(attempt) {
  return CRITICAL_RESOURCE_TYPES.has(String(attempt.resourceType || '').toLowerCase()) ? 'critical' : 'optional';
}

/**
 * Computes the acceptance level from evidence (never assigned manually).
 *
 * Policy (ADR-002):
 * - L0: no route responded
 * - L1: some route responded but missing local files / local failures exist
 * - L2: all routes 200, zero missing local files, zero local failures
 * - L3: L2 + zero unexpected console errors and zero pageerrors
 * - L4: offline run at level >= L2 AND zero critical external attempts AND
 *       zero declared-but-unexercised interactions. Optional external attempts
 *       are tolerated but recorded.
 *
 * @param {object} input
 * @param {boolean} input.offline
 * @param {boolean} input.allRoutes200
 * @param {{routesOk:number, consoleErrors:number, pageErrors:number, localFailures:number, missingFiles:number}} input.totals
 * @param {Array<{url:string, resourceType?:string}>} input.externalAttempts
 * @param {string[]} input.interactionsNotExercised
 * @returns {{level:string, reasons:string[], criticalAttempts:Array, optionalAttempts:Array}}
 */
export function computeAcceptance({ offline, allRoutes200, totals, externalAttempts = [], interactionsNotExercised = [] }) {
  const t = totals;
  const reasons = [];
  const criticalAttempts = externalAttempts.filter((a) => classifyExternalAttempt(a) === 'critical');
  const optionalAttempts = externalAttempts.filter((a) => classifyExternalAttempt(a) === 'optional');

  let level;
  if (t.routesOk === 0) {
    level = 'L0';
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

  if (offline) {
    if (!levelAtLeast(level, 'L2')) {
      reasons.push('L4 bloqueado: nível base abaixo de L2.');
    } else if (criticalAttempts.length > 0) {
      reasons.push(`L4 bloqueado: ${criticalAttempts.length} tentativa(s) externa(s) CRÍTICA(s) durante o teste offline (${criticalAttempts.map((a) => a.url).join(', ')}).`);
    } else if (interactionsNotExercised.length > 0) {
      reasons.push(`L4 bloqueado: interações declaradas não exercitadas (${interactionsNotExercised.join(', ')}).`);
    } else {
      level = 'L4';
      reasons.push(`Validação offline concluída; ${optionalAttempts.length} tentativa(s) externa(s) opcional(is) registrada(s).`);
    }
  }

  return { level, reasons, criticalAttempts, optionalAttempts };
}

/**
 * Builds the fixture-scoped classification metadata. The acceptance level applies
 * ONLY to the declared scope and target — never to arbitrary websites.
 *
 * @param {object} input
 * @param {Record<string, any>} input.config mirror.config.yaml content
 * @param {Record<string, any>} input.scope scope.lock.json content
 * @param {string} input.level computed acceptance level
 * @param {string[]} input.reasons
 * @param {Array} input.criticalAttempts
 * @param {Array} input.optionalAttempts
 * @param {string[]} input.interactionsNotExercised
 * @param {string[]} input.knownLimitations
 */
export function buildClassification({
  config,
  scope,
  level,
  reasons,
  criticalAttempts,
  optionalAttempts,
  interactionsNotExercised = [],
  knownLimitations = [],
}) {
  const target = config?.target || {};
  const validationTarget = target.type === 'local-controlled-fixture' ? 'local-controlled-fixture' : 'authorized-site';
  const viewports = (scope.viewports || []).map((v) => v.name);

  const capabilitiesExercised = ['authorization', 'allowlist', 'basic-html', 'basic-css', 'basic-assets'];
  if ((scope.routes?.include || []).length > 1) capabilitiesExercised.push('multi-route');
  if (viewports.includes('desktop')) capabilitiesExercised.push('desktop');
  if (viewports.includes('mobile')) capabilitiesExercised.push('mobile');
  if (levelAtLeast(level, 'L2')) capabilitiesExercised.push('routes');
  if (levelAtLeast(level, 'L3')) capabilitiesExercised.push('interactions', 'scroll');
  if (levelAtLeast(level, 'L4')) capabilitiesExercised.push('offline', 'byte-range');

  const capabilitiesNotExercised = [
    ...interactionsNotExercised,
    'spa-navigation',
    'service-worker',
    'webgl',
    'editable-recreation',
  ];

  const externalDependencies = [
    ...criticalAttempts.map((a) => ({ url: a.url, criticality: 'critical' })),
    ...optionalAttempts.map((a) => ({ url: a.url, criticality: 'optional' })),
  ];

  return {
    validationTarget,
    fixtureId: validationTarget === 'local-controlled-fixture' ? target.fixture_id || null : null,
    scopeType: 'declared-routes-and-viewports',
    acceptanceLevel: level,
    confidence: levelAtLeast(level, 'L2') && criticalAttempts.length === 0 ? 'high' : 'medium',
    capabilitiesExercised,
    capabilitiesNotExercised,
    knownLimitations,
    externalDependencies,
    reasons,
  };
}

/**
 * User-facing sentence for the acceptance level. Never claims universal support.
 * @param {ReturnType<typeof buildClassification>} classification
 * @returns {string}
 */
export function acceptanceSentence(classification) {
  const level = classification.acceptanceLevel;
  if (classification.validationTarget === 'local-controlled-fixture') {
    return `${level} validado para o escopo e fixture declarados${classification.fixtureId ? ` (${classification.fixtureId})` : ''}.`;
  }
  return `${level} validado para o escopo declarado (rotas e viewports do capture-plan).`;
}
