#!/usr/bin/env node
// HandoffReporter (A-012, MVP): transparent delivery with evidence and known gaps.
// Usage: node scripts/report.js --config mirror.config.yaml
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, resolveProject, requireScopeLock, isoNow } from './lib/config.js';
import { validateManifest, formatValidationErrors } from '../validators/index.js';
import { EXIT, failWith } from './lib/exit-codes.js';
import { acceptanceSentence } from './lib/acceptance.js';

const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readJson(file, fallback = null) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
}

function render(template, vars) {
  return Object.entries(vars).reduce((text, [key, value]) => text.replaceAll(`{{${key}}}`, String(value)), template);
}

function main() {
  const args = parseArgs(process.argv);
  const project = resolveProject(args.config || 'mirror.config.yaml');
  const scope = requireScopeLock(project);
  const manifest = readJson(project.files.manifest, {});
  // Manifest must satisfy the active schema before any report is produced
  if (Object.keys(manifest).length > 0) {
    const manifestCheck = validateManifest(manifest);
    if (!manifestCheck.valid) {
      failWith(EXIT.INVALID_CONFIG, formatValidationErrors('capture/manifest.json', manifestCheck.errors));
    }
  }
  const validation = readJson(project.files.validationResults, {});
  const dependencies = readJson(path.join(project.dirs.blueprint, 'dependencies.json'), null);

  const blocked = fs.existsSync(path.join(project.dirs.logs, 'blocked-external.jsonl'))
    ? fs.readFileSync(path.join(project.dirs.logs, 'blocked-external.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    : [];
  const failures = readJson(path.join(project.dirs.logs, 'network-failures.json'), []);
  const blockedHosts = [...new Set(blocked.map((b) => new URL(b.url).hostname))];
  const classification = validation?.classification?.acceptanceLevel || manifest.acceptanceLevel || 'pending-validation';
  const browserMatrix = readJson(path.join(project.dirs.capture, 'browser-matrix.json'), null);

  const templatePath = path.join(SKILL_ROOT, 'templates', 'report-template.md');
  const template = fs.readFileSync(templatePath, 'utf8');
  const report = render(template, {
    project: scope.projectId,
    source: scope.source.url,
    generatedAt: isoNow(),
    classification,
    mode: 'static-mirror',
    routesDeclared: manifest.routesDeclared ?? scope.routes.include.length,
    routesExercised: manifest.routesExercised ?? 0,
    viewports: (scope.viewports || []).map((v) => `${v.name} (${v.width}x${v.height})`).join(', '),
    interactionsDeclared: manifest.interactionsDeclared ?? 0,
    interactionsExercised: manifest.interactionsExercised ?? 0,
    resourcesLocal: manifest.resourcesLocal ?? 0,
    resourcesBlocked: manifest.resourcesBlocked ?? 0,
    resourcesFailed: manifest.resourcesFailed ?? 0,
    requestsObserved: manifest.requestsObserved ?? 0,
    authorizationHash: scope.authorizationHash,
    byteRange: validation?.byteRange ? `HTTP ${validation.byteRange.status} em ${validation.byteRange.asset}` : 'não testado',
    offlineValidated: classification === 'L4' ? 'sim' : 'não',
  });
  // Browser matrix section (Browser Runtime Strategy): official source + every pass
  let browserSection = '';
  if (browserMatrix) {
    const rows = browserMatrix.passes.map((p) => `| ${p.id} | ${p.engine}${p.channel ? ` (${p.channel})` : ''} | ${p.status} | ${p.officialAcquisition ? 'sim' : 'não'} | ${p.reason || '—'} |`);
    browserSection = [
      '',
      '## Navegadores (browser matrix)',
      '',
      `- Fonte oficial de aquisição: **${browserMatrix.acquisitionSource}**${manifest.browser?.version ? ` (versão ${manifest.browser.version}, playwright ${manifest.browser.playwrightVersion})` : ''}`,
      `- Contexto oficial: ${manifest.browser?.contextMode || 'clean'} | cache: ${manifest.browser?.cacheState || 'clean'} | CDP: ${manifest.browser?.cdpEnabled ? 'habilitado' : 'desabilitado'} | SW policy: ${manifest.browser?.serviceWorkerPolicy || 'inspect'}`,
      `- Validações secundárias (chrome/firefox) NUNCA alteram o manifesto oficial; artefatos em capture/browser-validation/.`,
      '',
      '| Passe | Engine | Status | Oficial | Motivo/Nota |',
      '| --- | --- | --- | --- | --- |',
      ...rows,
      '',
    ].join('\n');
    const executed = browserMatrix.passes.filter((p) => p.status === 'passed').length;
    const skipped = browserMatrix.passes.filter((p) => ['skipped', 'disabled'].includes(p.status)).length;
    console.log(`Navegadores: ${executed} passes executados, ${skipped} ignorados/desabilitados (ver capture/browser-matrix.json)`);
  }
  fs.writeFileSync(path.join(project.outputDir, 'REPORT.md'), report + browserSection, 'utf8');

  const gaps = [
    '# KNOWN-GAPS — Lacunas conhecidas',
    '',
    `Gerado em: ${isoNow()}`,
    '',
    '## Interações não exercitadas',
    ...(manifest.interactionsNotExercised?.length
      ? manifest.interactionsNotExercised.map((i) => `- ${i}`)
      : ['- nenhuma declarada']),
    '',
    '## Recursos bloqueados (fora da allowlist)',
    ...(blockedHosts.length ? blockedHosts.map((h) => `- ${h} (${blocked.filter((b) => b.url.includes(h)).length} requisições)`) : ['- nenhum']),
    '',
    '## Falhas de rede / aquisição',
    ...(failures.length ? failures.slice(0, 50).map((f) => `- ${f.url} — ${f.error}`) : ['- nenhuma']),
    '',
    '## Limitações do método',
    '- O HTML servido é o DOM pós-hidratação; scripts capturados podem reaplicar efeitos já presentes no DOM (ex.: duplicar nós inseridos via JS). Se isso quebrar a experiência, usar Editable Recreation.',
    '- JavaScript: apenas referências estáticas literais são reescritas (import/export/dynamic import/Worker/new URL/fetch). Strings arbitrárias e URLs construídas dinamicamente NÃO são reescritas — ver capture/rewrite-report.json.',
    '- Caminhos estáticos conhecidos fora das posições AST suportadas (ex.: concatenação parcial) não são reescritos.',
    '- Conteúdo INTERNO de source maps (.map) não é reescrito; o comentário sourceMappingURL só é reescrito quando o .map foi capturado.',
    '- Páginas HTML são resserializadas pelo parse5 e CSS pelo postcss: formatação/escape podem diferir do original (semântica preservada).',
    '- Aliases de redirect servem o conteúdo final com 200 (o mirror não reproduz o status 30x).',
    '- Mídia capturada via download direto autorizado (o navegador entrega apenas fragmentos 206).',
    '- Classificação (L0–L4) vale APENAS para o alvo e escopo declarados em validation-results.json → classification (ver ADR-002).',
    '- WebKit: reservado (não implementado). Brave: não suportado como aquisição (apenas validação opcional futura).',
    '- Chrome Stable e Firefox são validações secundárias: não alteram manifesto nem nível oficial do Chromium; suporte cross-browser NÃO é declarado com base em fixture.',
    '- Service Workers: inspeção estrutural apenas (pass 3, quando habilitado); replicação é PH-002.',
    '- Schemas de blueprint completo residem em schemas/future/ (PH-004), sem validação ativa em runtime.',
    '- Análise frame a frame de animações, scroll-map e componentes: pós-MVP (classificados como "unexercised").',
    '- Service Workers são detectados mas não replicados (PH-002).',
    '- WebGL/Three.js: apenas sinais registrados (PH-003).',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(project.outputDir, 'KNOWN-GAPS.md'), gaps, 'utf8');

  const deps = [
    '# DEPENDENCIES — Dependências externas',
    '',
    `Gerado em: ${isoNow()}`,
    '',
    '## Hosts capturados (approved-local)',
    ...(dependencies?.capturedHosts?.length ? dependencies.capturedHosts.map((d) => `- ${d.host}`) : ['- nenhum']),
    '',
    '## Hosts externos bloqueados (blocked)',
    ...(blockedHosts.length ? blockedHosts.map((h) => `- ${h}`) : ['- nenhum']),
    '',
  ].join('\n');
  fs.writeFileSync(path.join(project.outputDir, 'DEPENDENCIES.md'), deps, 'utf8');

  const authSummary = [
    '# AUTHORIZATION-SUMMARY',
    '',
    `- Projeto: ${scope.projectId}`,
    `- Tipo: ${scope.authorizationType}`,
    `- Domínio primário: ${scope.source.primaryDomain}`,
    `- Domínios permitidos: ${scope.domains.join(', ')}`,
    `- Rotas: ${scope.routes.include.join(', ')}`,
    `- Válida até: ${scope.validUntil || 'não informado'}`,
    `- Hash da autorização: ${scope.authorizationHash}`,
    '',
    'Nenhum cookie, token ou credencial faz parte desta entrega.',
  ].join('\n');
  fs.writeFileSync(path.join(project.outputDir, 'AUTHORIZATION-SUMMARY.md'), authSummary, 'utf8');

  const launch = [
    '# LAUNCH — Como executar o mirror localmente',
    '',
    '```bash',
    'node server/serve.js --contract capture/serving-contract.json',
    '```',
    '',
    `Servidor em http://127.0.0.1:4173 (SPA fallback desativado, 404 real para ausentes).`,
    '',
    '## Revalidar',
    '```bash',
    'node scripts/validate.js --config mirror.config.yaml            # validação online local',
    'node scripts/validate.js --config mirror.config.yaml --offline  # validação offline',
    '```',
  ].join('\n');
  fs.writeFileSync(path.join(project.outputDir, 'LAUNCH.md'), launch, 'utf8');

  console.log('\nCaptura concluída.\n');
  const classificationMeta = validation?.classification?.acceptanceLevel
    ? validation.classification
    : { acceptanceLevel: classification, validationTarget: manifest.validationTarget || 'authorized-site', fixtureId: manifest.fixtureId || null };
  console.log(`Classificação: ${classification} — ${acceptanceSentence(classificationMeta)}`);
  console.log('Método: Static Mirror');
  console.log(`Rotas declaradas: ${manifest.routesDeclared ?? '?'} | Rotas validadas: ${validation?.totals?.routesOk ?? '?'}`);
  console.log(`Interações declaradas: ${manifest.interactionsDeclared ?? '?'} | Interações validadas: ${manifest.interactionsExercised ?? '?'}`);
  console.log(`Recursos locais: ${manifest.resourcesLocal ?? '?'} | Bloqueados: ${manifest.resourcesBlocked ?? '?'} | Falhas: ${manifest.resourcesFailed ?? '?'}`);
  console.log(`Offline validado: ${classification === 'L4' ? 'sim' : 'não'}`);
  console.log('\nComando de inicialização:\n  node server/serve.js --contract capture/serving-contract.json');
  console.log('\nConsulte: REPORT.md, KNOWN-GAPS.md, DEPENDENCIES.md, capture/manifest.json, experience-blueprint/');
}

try {
  main();
} catch (err) {
  failWith(EXIT.INTERNAL_ERROR, `[REPORT] Falha fatal: ${err.message}`);
}
