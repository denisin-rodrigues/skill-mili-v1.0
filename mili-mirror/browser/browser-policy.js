// Central browser policy (Milestone: Browser Runtime Strategy).
// Single contract for every browser decision: acquisition, validation, channels,
// headless, context modes, cache state, Service Worker policy, CDP, required/optional,
// timeouts and the reason for each choice. No other file may invent browser decisions.

export const ENGINE = Object.freeze({ CHROMIUM: 'chromium', FIREFOX: 'firefox', WEBKIT: 'webkit' });
export const DISTRIBUTION = Object.freeze({ PLAYWRIGHT: 'playwright', CHANNEL: 'channel' });

/**
 * The six modeled passes. officialAcquisition is true ONLY for Playwright Chromium
 * discovery passes — secondary validations never modify the official manifest.
 */
export const PASS_DEFINITIONS = Object.freeze([
  {
    id: 'chromium-clean-discovery',
    order: 1,
    engine: ENGINE.CHROMIUM,
    distribution: DISTRIBUTION.PLAYWRIGHT,
    contextMode: 'clean',
    cacheState: 'clean',
    officialAcquisition: true,
    description: 'Novo contexto, cache limpo, descoberta inicial, registro de rede, screenshot inicial.',
  },
  {
    id: 'chromium-interaction-discovery',
    order: 2,
    engine: ENGINE.CHROMIUM,
    distribution: DISTRIBUTION.PLAYWRIGHT,
    contextMode: 'clean',
    cacheState: 'clean',
    officialAcquisition: true,
    description: 'Scroll, interações seguras, mídia, lazy assets, rotas declaradas.',
  },
  {
    id: 'chromium-warm-runtime',
    order: 3,
    engine: ENGINE.CHROMIUM,
    distribution: DISTRIBUTION.PLAYWRIGHT,
    contextMode: 'persistent',
    cacheState: 'warm',
    enabledByDefault: false,
    officialAcquisition: false,
    description: 'Perfil exclusivo persistente, cache aquecido, inspeção de Service Worker. Somente quando habilitado.',
  },
  {
    id: 'chromium-offline-validation',
    order: 4,
    engine: ENGINE.CHROMIUM,
    distribution: DISTRIBUTION.PLAYWRIGHT,
    contextMode: 'clean',
    cacheState: 'clean',
    officialAcquisition: false,
    description: 'Nova sessão, rede externa bloqueada, recursos locais permitidos, registro de tentativas externas.',
  },
  {
    id: 'chrome-production-validation',
    order: 5,
    engine: ENGINE.CHROMIUM,
    channel: 'chrome',
    officialAcquisition: false,
    description: 'Chrome Stable real: validação secundária de produção e mídia. Não adquire para o manifesto oficial.',
  },
  {
    id: 'firefox-compatibility',
    order: 6,
    engine: ENGINE.FIREFOX,
    officialAcquisition: false,
    description: 'Validação opcional de compatibilidade; registra diferenças sem alterar o nível oficial.',
  },
]);

/**
 * Default policy. Every field documents WHY the choice exists.
 */
export const DEFAULT_BROWSER_POLICY = Object.freeze({
  acquisition: {
    engine: ENGINE.CHROMIUM,
    distribution: DISTRIBUTION.PLAYWRIGHT,
    headless: true,
    useCdp: true,
    required: true,
    serviceWorkerPolicy: 'inspect',
    contextMode: 'clean',
    cacheState: 'clean',
    timeoutMs: 60000,
    reason: 'Navegador principal: descoberta, captura de rede, aquisição, CDP, Service Workers, WebGL, screenshots e validação offline.',
  },
  productionValidation: {
    engine: ENGINE.CHROMIUM,
    channel: 'chrome',
    required: false,
    headless: true,
    reason: 'Validação secundária de produção/mídia em Chrome Stable real. Nunca obrigatório para a captura básica.',
  },
  compatibility: {
    firefox: {
      enabled: false,
      required: false,
      headless: true,
      reason: 'Validação opcional de compatibilidade. Não é coletor principal; instalação não exigida no MVP.',
    },
    webkit: {
      enabled: false,
      required: false,
      supported: false,
      reason: 'RESERVADO para validação futura. Não implementado.',
    },
  },
  brave: {
    supportedAsAcquisition: false,
    reason: 'Brave NUNCA é navegador oficial de captura. Futuro apenas como validação opcional.',
  },
  passes: {
    warmRuntime: false,
  },
  profiles: {
    clean: { persistent: false, cacheState: 'clean' },
    warm: { persistent: true, cacheState: 'warm', userDataDir: null }, // null → computed under output dir
  },
});

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function merge(base, override) {
  const out = { ...base };
  for (const [key, value] of Object.entries(override || {})) {
    if (isPlainObject(value) && isPlainObject(out[key])) out[key] = merge(out[key], value);
    else if (value !== undefined && value !== null) out[key] = value;
  }
  return out;
}

/**
 * Hard rules that user configuration can NEVER change (safety invariants).
 */
function enforceInvariants(policy) {
  const p = structuredClone(policy);
  p.acquisition.engine = ENGINE.CHROMIUM;
  p.acquisition.distribution = DISTRIBUTION.PLAYWRIGHT;
  p.acquisition.required = true;
  p.compatibility.webkit.supported = false;
  p.brave.supportedAsAcquisition = false;
  return p;
}

/**
 * Resolves the effective browser policy from mirror.config.yaml (browser: section).
 * @param {Record<string, any>} [config] full mirror.config.yaml content
 * @returns policy object (see DEFAULT_BROWSER_POLICY shape)
 */
export function resolveBrowserPolicy(config = {}) {
  const raw = config?.browser || {};

  const mapped = {};
  if (raw.acquisition) {
    mapped.acquisition = { ...raw.acquisition };
    if (raw.acquisition.use_cdp !== undefined) {
      mapped.acquisition.useCdp = raw.acquisition.use_cdp;
      delete mapped.acquisition.use_cdp;
    }
  }
  if (raw.production_validation) mapped.productionValidation = raw.production_validation;
  if (raw.compatibility_validation) {
    mapped.compatibility = {};
    if (raw.compatibility_validation.firefox) mapped.compatibility.firefox = raw.compatibility_validation.firefox;
    if (raw.compatibility_validation.webkit) mapped.compatibility.webkit = raw.compatibility_validation.webkit;
  }
  if (raw.passes) {
    mapped.passes = {};
    if (raw.passes.warm_runtime !== undefined) mapped.passes.warmRuntime = raw.passes.warm_runtime;
  }
  if (raw.profiles) mapped.profiles = raw.profiles;

  return enforceInvariants(merge(DEFAULT_BROWSER_POLICY, mapped));
}

/**
 * Validation-browsers enabled by configuration (for --all-enabled-browsers).
 * @param {ReturnType<typeof resolveBrowserPolicy>} policy resolved policy
 * @returns {Array<{id:string, engine:string, channel?:string, required:boolean, enabled:boolean}>}
 */
export function enabledValidationBrowsers(policy) {
  const list = [
    {
      id: 'chrome-production-validation',
      engine: ENGINE.CHROMIUM,
      channel: policy.productionValidation.channel,
      required: policy.productionValidation.required === true,
      enabled: true, // Chrome Stable is always a candidate; detection decides run vs skip
    },
    {
      id: 'firefox-compatibility',
      engine: ENGINE.FIREFOX,
      required: policy.compatibility.firefox.required === true,
      enabled: policy.compatibility.firefox.enabled === true,
    },
  ];
  return list;
}

/**
 * Decision for a secondary validation browser (pure, unit-testable).
 * @param {{available:boolean, reason?:string}} detection
 * @param {{required:boolean, enabled?:boolean}} cfg
 * @returns {'run'|'skip'|'fail'}
 */
export function decideSecondaryRun(detection, cfg) {
  if (cfg.enabled === false) return 'skip';
  if (detection.available) return 'run';
  return cfg.required ? 'fail' : 'skip';
}
