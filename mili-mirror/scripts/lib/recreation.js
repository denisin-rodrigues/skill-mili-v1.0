import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ensureDir, isoNow, writeJson } from './config.js';
import { resolveWithin } from './safe-path.js';

const CLASSIFICATIONS = new Set(['reconstructed', 'approximated']);
const ASSET_CLASSIFICATIONS = new Set(['captured', 'reconstructed', 'approximated']);

function requireString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Plano de Recreation inválido: ${field} deve ser uma string não vazia.`);
  }
}

function requireStringArray(value, field) {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== 'string' || item.trim() === '')) {
    throw new Error(`Plano de Recreation inválido: ${field} deve conter pelo menos uma string não vazia.`);
  }
}

export function validateRecreationPlan(plan) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    throw new Error('Plano de Recreation inválido: objeto esperado.');
  }
  if (plan.version !== 1) {
    throw new Error(`Plano de Recreation incompatível: version ${plan.version ?? 'ausente'}; esperado 1.`);
  }

  requireString(plan.activationReason, 'activationReason');
  requireString(plan.brand?.name, 'brand.name');
  requireString(plan.brand?.accent, 'brand.accent');
  requireString(plan.brand?.ink, 'brand.ink');
  requireString(plan.brand?.paper, 'brand.paper');
  requireStringArray(plan.hero?.titleLines, 'hero.titleLines');
  requireStringArray(plan.hero?.subtitleLines, 'hero.subtitleLines');
  requireString(plan.about?.eyebrow, 'about.eyebrow');
  requireString(plan.about?.statement, 'about.statement');
  requireString(plan.contact?.label, 'contact.label');
  requireString(plan.contact?.href, 'contact.href');
  requireString(plan.contact?.prompt, 'contact.prompt');

  if (!Array.isArray(plan.navigation)) {
    throw new Error('Plano de Recreation inválido: navigation deve ser uma lista.');
  }
  for (const [index, item] of plan.navigation.entries()) {
    requireString(item?.label, `navigation[${index}].label`);
    requireString(item?.href, `navigation[${index}].href`);
  }

  if (plan.projects !== undefined && (!Array.isArray(plan.projects) || plan.projects.length === 0)) {
    throw new Error('Plano de Recreation inválido: projects deve conter pelo menos um projeto quando informado.');
  }
  if (plan.projects?.length) {
    requireString(plan.work?.eyebrow, 'work.eyebrow');
    requireString(plan.work?.title, 'work.title');
  }
  for (const [index, item] of (plan.projects || []).entries()) {
    requireString(item?.title, `projects[${index}].title`);
    requireString(item?.slug, `projects[${index}].slug`);
    requireString(item?.client, `projects[${index}].client`);
    requireString(item?.year, `projects[${index}].year`);
    requireString(item?.summary, `projects[${index}].summary`);
    requireStringArray(item?.disciplines, `projects[${index}].disciplines`);
    requireString(item?.colors?.primary, `projects[${index}].colors.primary`);
    requireString(item?.colors?.secondary, `projects[${index}].colors.secondary`);
    const caseFields = [item?.image, item?.imageAlt, item?.detail];
    const declaredCaseFields = caseFields.filter((value) => value !== undefined);
    if (declaredCaseFields.length > 0 && declaredCaseFields.length !== caseFields.length) {
      throw new Error(
        `Plano de Recreation inválido: projects[${index}] deve declarar image, imageAlt e detail juntos.`,
      );
    }
    if (declaredCaseFields.length === caseFields.length) {
      requireString(item.image, `projects[${index}].image`);
      requireString(item.imageAlt, `projects[${index}].imageAlt`);
      requireString(item.detail, `projects[${index}].detail`);
      if (!item.image.startsWith('/') || item.image.includes('..')) {
        throw new Error(`Plano de Recreation inválido: projects[${index}].image deve ser um caminho público absoluto seguro.`);
      }
    }
  }

  if (plan.heroScene !== undefined) {
    requireString(plan.heroScene.engine, 'heroScene.engine');
    requireString(plan.heroScene.concept, 'heroScene.concept');
    if (!CLASSIFICATIONS.has(plan.heroScene.classification)) {
      throw new Error('Plano de Recreation inválido: heroScene.classification deve ser reconstructed ou approximated.');
    }
  }

  if (!Array.isArray(plan.evidence) || plan.evidence.length === 0) {
    throw new Error('Plano de Recreation inválido: evidence deve registrar pelo menos uma evidência.');
  }
  for (const [index, item] of plan.evidence.entries()) {
    requireString(item?.component, `evidence[${index}].component`);
    requireString(item?.source, `evidence[${index}].source`);
    requireString(item?.note, `evidence[${index}].note`);
    if (!CLASSIFICATIONS.has(item?.classification)) {
      throw new Error(
        `Plano de Recreation inválido: evidence[${index}].classification deve ser reconstructed ou approximated.`,
      );
    }
  }

  if (plan.assets !== undefined && !Array.isArray(plan.assets)) {
    throw new Error('Plano de Recreation inválido: assets deve ser uma lista.');
  }
  for (const [index, item] of (plan.assets || []).entries()) {
    requireString(item?.source, `assets[${index}].source`);
    requireString(item?.target, `assets[${index}].target`);
    requireString(item?.classification, `assets[${index}].classification`);
    if (!ASSET_CLASSIFICATIONS.has(item.classification)) {
      throw new Error(
        `Plano de Recreation inválido: assets[${index}].classification deve ser captured, reconstructed ou approximated.`,
      );
    }
  }

  for (const [index, project] of (plan.projects || []).entries()) {
    if (!project.image) continue;
    const expectedTarget = project.image.replace(/^\/+/, '');
    const hasAsset = (plan.assets || []).some((asset) => asset.target.replaceAll('\\', '/') === expectedTarget);
    if (!hasAsset) {
      throw new Error(`Plano de Recreation inválido: projects[${index}].image não possui asset correspondente (${expectedTarget}).`);
    }
  }

  return plan;
}

export function renderContentModule(plan) {
  const content = {
    brandName: plan.brand.name,
    navigation: plan.navigation,
    hero: plan.hero,
    about: plan.about,
    work: plan.work || { eyebrow: 'Selected work', title: 'A selection of collaborative projects.' },
    projects: plan.projects || [],
    contact: plan.contact,
  };
  return `// Gerado por Mili Mirror. Edite este arquivo para alterar o conteúdo sem tocar no layout.\nexport const siteContent = ${JSON.stringify(content, null, 2)} as const;\n`;
}

export function renderBrandModule(plan) {
  const brand = {
    accent: plan.brand.accent,
    ink: plan.brand.ink,
    paper: plan.brand.paper,
    support: plan.brand.support || '#ff6b57',
    displayFont: plan.brand.displayFont || 'Butter Display',
    bodyFont: plan.brand.bodyFont || 'Arial, sans-serif',
  };
  return `// Gerado por Mili Mirror. Edite os tokens para alterar o tema global.\nexport const brand = ${JSON.stringify(brand, null, 2)} as const;\n`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function renderIndexHtml(plan) {
  const title = escapeHtml(plan.brand.name);
  const description = escapeHtml([...plan.hero.titleLines, ...plan.hero.subtitleLines].join(' '));
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="${escapeHtml(plan.brand.ink)}" />
    <meta name="description" content="${description}" />
    <title>${title}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
}

export function renderReconstructionMap(plan, state) {
  const rows = plan.evidence
    .map(
      (item) =>
        `| ${item.component.replaceAll('|', '\\|')} | ${item.classification} | ${item.source.replaceAll('|', '\\|')} | ${item.note.replaceAll('|', '\\|')} |`,
    )
    .join('\n');
  const assets = state.assets.length
    ? state.assets
        .map(
          (asset) =>
            `- \`${asset.target}\` — ${asset.classification}; SHA-256 \`${asset.sha256}\`; origem: \`${asset.source}\`.`,
        )
        .join('\n')
    : '- Nenhum asset copiado nesta fatia.';

  return `# RECONSTRUCTION-MAP — ${plan.brand.name}

Gerado em: ${state.generatedAt}

## Ativação

${plan.activationReason}

## Escopo desta fatia

${state.scope.join(', ')}. Itens ainda não implementados: ${state.notImplemented.join(', ')}.
${
  state.heroScene
    ? `\n## Cena 3D do hero\n\nEngine: ${state.heroScene.engine}. Classificação: ${state.heroScene.classification}. Conceito: ${state.heroScene.concept} — obra original, não deriva da cena WebGL do site autorizado.\n`
    : ''
}
## Evidências e classificação

| Componente | Classificação | Evidência | Nota |
| --- | --- | --- | --- |
${rows}

## Assets reutilizados

${assets}

## Declaração

Esta entrega é uma **Editable Recreation**. Nenhum componente é apresentado como código-fonte original recuperado.
`;
}

function hashFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function copyPlanAssets(projectRoot, recreationRoot, assets) {
  return assets.map((asset) => {
    const source = resolveWithin(projectRoot, asset.source);
    if (source.ok === false) {
      throw new Error(`Asset de Recreation fora da raiz autorizada (${asset.source}): ${source.reason}.`);
    }
    if (!fs.existsSync(source.abs) || !fs.statSync(source.abs).isFile()) {
      throw new Error(`Asset de Recreation não encontrado: ${source.abs}`);
    }

    const target = resolveWithin(path.join(recreationRoot, 'public'), asset.target, { checkSymlink: false });
    if (target.ok === false) {
      throw new Error(`Destino de asset inválido (${asset.target}): ${target.reason}.`);
    }
    ensureDir(path.dirname(target.abs));
    fs.copyFileSync(source.abs, target.abs);
    return {
      source: asset.source,
      target: path.posix.join('public', asset.target.replaceAll('\\', '/')),
      classification: asset.classification,
      sha256: hashFile(target.abs),
    };
  });
}

function computeRecreationState(plan, assets, project) {
  const hasProjects = Array.isArray(plan.projects) && plan.projects.length > 0;
  const caseProjects = (plan.projects || []).filter((item) => item.image && item.imageAlt && item.detail);
  const caseRoutes = caseProjects.map((item) => `/work/${item.slug}`);
  const allCasesImplemented = hasProjects && caseRoutes.length === plan.projects.length;
  const hasHeroScene = Boolean(plan.heroScene);
  return {
    version: 1,
    generatedAt: isoNow(),
    mode: assets.some((asset) => asset.classification === 'captured') ? 'hybrid' : 'editable-recreation',
    classification: 'approximated',
    activationReason: plan.activationReason,
    source: project.config?.source?.url || null,
    scope: [
      'header',
      'hero',
      'about',
      ...(hasProjects ? ['projects'] : []),
      ...(caseRoutes.length ? ['case-routes'] : []),
      ...(hasHeroScene ? ['hero-3d-scene'] : []),
    ],
    projectCount: hasProjects ? plan.projects.length : 0,
    caseRoutes,
    cases: caseProjects.map((item) => ({ slug: item.slug, title: item.title, image: item.image })),
    heroScene: hasHeroScene
      ? { engine: plan.heroScene.engine, concept: plan.heroScene.concept, classification: plan.heroScene.classification }
      : null,
    notImplemented: [
      ...(hasProjects ? [] : ['projects']),
      ...(allCasesImplemented ? [] : ['case-routes']),
      ...(hasHeroScene ? [] : ['webgl', 'three-scene']),
      'visual-editor',
    ],
    assets,
  };
}

export function createRecreationProject({ project, plan, templateRoot, output = 'recreation' }) {
  validateRecreationPlan(plan);

  const template = path.resolve(templateRoot);
  if (!fs.existsSync(template) || !fs.statSync(template).isDirectory()) {
    throw new Error(`Template de Recreation não encontrado: ${template}`);
  }

  const outputResolution = resolveWithin(project.outputDir, output, { checkSymlink: false });
  if (outputResolution.ok === false) {
    throw new Error(`Diretório de Recreation inválido (${output}): ${outputResolution.reason}.`);
  }
  const recreationRoot = outputResolution.abs;
  if (fs.existsSync(recreationRoot) && fs.readdirSync(recreationRoot).length > 0) {
    throw new Error(
      `Diretório de Recreation já contém arquivos: ${recreationRoot}. Nada foi sobrescrito; escolha outro --output.`,
    );
  }

  ensureDir(recreationRoot);
  fs.cpSync(template, recreationRoot, { recursive: true, errorOnExist: true, force: false });

  const assets = copyPlanAssets(project.outputDir, recreationRoot, plan.assets || []);
  ensureDir(path.join(recreationRoot, 'src', 'content'));
  ensureDir(path.join(recreationRoot, 'src', 'config'));
  fs.writeFileSync(path.join(recreationRoot, 'src', 'content', 'site-content.ts'), renderContentModule(plan), 'utf8');
  fs.writeFileSync(path.join(recreationRoot, 'src', 'config', 'brand.ts'), renderBrandModule(plan), 'utf8');
  fs.writeFileSync(path.join(recreationRoot, 'index.html'), renderIndexHtml(plan), 'utf8');

  const state = computeRecreationState(plan, assets, project);
  writeJson(path.join(recreationRoot, 'recreation-state.json'), state);
  fs.writeFileSync(path.join(recreationRoot, 'RECONSTRUCTION-MAP.md'), renderReconstructionMap(plan, state), 'utf8');

  return { recreationRoot, state };
}

/**
 * Atualiza conteúdo, tema e estado de uma Recreation já gerada, quando o plano evolui
 * (ex.: cases adicionados após a fatia inicial). Nunca toca no scaffold (App.tsx, estilos,
 * package.json) — apenas content/, config/, index.html, assets do plano e recreation-state.json.
 */
export function updateRecreationContent({ project, plan, output = 'recreation' }) {
  validateRecreationPlan(plan);

  const outputResolution = resolveWithin(project.outputDir, output, { checkSymlink: false });
  if (outputResolution.ok === false) {
    throw new Error(`Diretório de Recreation inválido (${output}): ${outputResolution.reason}.`);
  }
  const recreationRoot = outputResolution.abs;
  const statePath = path.join(recreationRoot, 'recreation-state.json');
  if (!fs.existsSync(statePath)) {
    throw new Error(
      `Nenhuma Recreation encontrada em ${recreationRoot}. Execute scripts/recreate.js primeiro para criar o projeto.`,
    );
  }

  const assets = copyPlanAssets(project.outputDir, recreationRoot, plan.assets || []);
  ensureDir(path.join(recreationRoot, 'src', 'content'));
  ensureDir(path.join(recreationRoot, 'src', 'config'));
  fs.writeFileSync(path.join(recreationRoot, 'src', 'content', 'site-content.ts'), renderContentModule(plan), 'utf8');
  fs.writeFileSync(path.join(recreationRoot, 'src', 'config', 'brand.ts'), renderBrandModule(plan), 'utf8');
  fs.writeFileSync(path.join(recreationRoot, 'index.html'), renderIndexHtml(plan), 'utf8');

  const state = computeRecreationState(plan, assets, project);
  writeJson(statePath, state);
  fs.writeFileSync(path.join(recreationRoot, 'RECONSTRUCTION-MAP.md'), renderReconstructionMap(plan, state), 'utf8');

  return { recreationRoot, state };
}
