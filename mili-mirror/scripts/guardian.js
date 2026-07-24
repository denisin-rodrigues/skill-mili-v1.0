#!/usr/bin/env node
// Guardian (A-001): validates authorization, locks scope and blocks out-of-scope execution.
// Usage: node scripts/guardian.js --config mirror.config.yaml --authorization authorization.yaml
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, loadYaml, resolveProject, writeJson, ensureDir, isoNow } from './lib/config.js';
import { sha256File } from './lib/hash.js';
import { isLocalhostHost } from './lib/allowlist.js';
import { SENSITIVE_HEADERS } from './lib/redact.js';

const KNOWN_AUTH_TYPES = [
  'owner',
  'client-approved',
  'employee',
  'license',
  'local-self-declared',
];

function fail(reasons) {
  console.error('\n[GUARDIAN] Autorização NEGADA. Nenhuma captura pode iniciar.');
  for (const reason of reasons) console.error(`  - ${reason}`);
  process.exit(1);
}

function main() {
  const args = parseArgs(process.argv);
  const configPath = args.config || 'mirror.config.yaml';
  const authPath = args.authorization || 'authorization.yaml';

  const project = resolveProject(configPath);
  const { config } = project;
  const problems = [];

  let auth;
  try {
    auth = loadYaml(authPath);
  } catch (err) {
    fail([err.message]);
  }

  const sourceUrl = config?.source?.url;
  if (!sourceUrl) problems.push('mirror.config.yaml: source.url ausente.');

  let sourceHost = '';
  try {
    sourceHost = new URL(sourceUrl).hostname.toLowerCase();
  } catch {
    problems.push(`mirror.config.yaml: source.url inválida (${sourceUrl}).`);
  }

  const localTarget = isLocalhostHost(sourceHost);
  const authType = auth?.authorization_type;
  if (!authType || !KNOWN_AUTH_TYPES.includes(authType)) {
    problems.push(`authorization.yaml: authorization_type inválido ou ausente (válidos: ${KNOWN_AUTH_TYPES.join(', ')}).`);
  }

  if (localTarget && authType !== 'local-self-declared') {
    console.warn('[GUARDIAN] Alvo local detectado; recomendado authorization_type: local-self-declared.');
  }
  if (!localTarget && authType === 'local-self-declared') {
    problems.push('Autodeclaração local só é permitida para localhost/ambientes internos (DV-004).');
  }

  // Expiry check
  const validUntil = auth?.valid_until ? new Date(auth.valid_until) : null;
  if (validUntil && Number.isNaN(validUntil.getTime())) {
    problems.push(`authorization.yaml: valid_until inválido (${auth.valid_until}).`);
  } else if (validUntil && validUntil < new Date()) {
    problems.push(`Autorização expirada em ${auth.valid_until}.`);
  }

  // Domain scope: config domains must be inside authorization domains
  const authDomains = (auth?.authorized_domains || []).map((d) => String(d).toLowerCase());
  const configDomains = (config?.source?.authorized_domains || []).map((d) => String(d).toLowerCase());
  if (!localTarget) {
    if (authDomains.length === 0) problems.push('authorization.yaml: authorized_domains vazio.');
    if (sourceHost && !authDomains.includes(sourceHost)) {
      problems.push(`Domínio principal ${sourceHost} não está em authorized_domains da autorização.`);
    }
    for (const domain of configDomains) {
      if (domain.startsWith('*.')) continue;
      if (!authDomains.includes(domain)) {
        problems.push(`Domínio do config fora da autorização: ${domain}.`);
      }
    }
  }

  // Route scope
  const configRoutes = config?.routes?.include || ['/'];
  const authRoutes = auth?.authorized_routes || [];
  const authAllowsAllRoutes = authRoutes.includes('*');
  if (!localTarget && !authAllowsAllRoutes) {
    for (const route of configRoutes) {
      if (!authRoutes.includes(route)) {
        problems.push(`Rota do config fora da autorização: ${route}.`);
      }
    }
  }

  if (authType === 'none' || auth?.authorized_actions?.static_asset_capture === false) {
    problems.push('Sem autorização de captura. Apenas análise pública limitada ou Inspired Transformation seriam permitidos (fora do escopo deste pipeline).');
  }

  if (problems.length > 0) fail(problems);

  // Approved: lock the scope
  const authAbs = path.resolve(authPath);
  const authHash = `sha256:${sha256File(authAbs)}`;
  const domains = localTarget
    ? [sourceHost, ...configDomains]
    : [...new Set([sourceHost, ...authDomains, ...configDomains])];

  const scopeLock = {
    projectId: config?.project?.name || 'ntm_project',
    status: 'approved',
    issuedAt: isoNow(),
    validUntil: auth?.valid_until || null,
    authorizationType: authType,
    authorizationHash: authHash,
    source: { url: sourceUrl, primaryDomain: sourceHost },
    domains,
    routes: { include: configRoutes, exclude: config?.routes?.exclude || [] },
    actions: auth?.authorized_actions || {},
    viewports: config?.viewports || [],
    localTarget,
  };

  ensureDir(project.outputDir);
  ensureDir(project.dirs.capture);
  writeJson(project.files.scopeLock, scopeLock);
  fs.writeFileSync(project.files.authHash, `${authHash}\n`, 'utf8');
  writeJson(path.join(project.dirs.capture, 'domain-allowlist.json'), {
    defaultPolicy: 'deny',
    allowed: domains,
    generatedAt: isoNow(),
  });
  writeJson(path.join(project.dirs.capture, 'redaction-policy.json'), {
    sensitiveHeaders: SENSITIVE_HEADERS,
    rules: [
      'Nunca registrar cookies, tokens ou Authorization headers.',
      'Mascarar segredos em logs, HARs e relatórios.',
      'Estado de autenticação não faz parte da entrega final.',
    ],
  });
  writeJson(path.join(project.dirs.capture, 'authorization-validation.json'), {
    status: 'approved',
    checkedAt: isoNow(),
    authorizationType: authType,
    validUntil: auth?.valid_until || null,
    domains,
    routes: configRoutes,
  });

  console.log('\n[GUARDIAN] Autorização APROVADA. Escopo travado.');
  console.log(`  Domínios permitidos: ${domains.join(', ')}`);
  console.log(`  Rotas autorizadas: ${configRoutes.join(', ')}`);
  console.log(`  scope.lock.json: ${project.files.scopeLock}`);
}

main();
