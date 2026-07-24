#!/usr/bin/env node
// ExperienceBlueprintBuilder (A-008, MVP): initial structured map of the experience.
// Usage: node scripts/blueprint.js --config mirror.config.yaml
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, resolveProject, requireScopeLock, writeJson, isoNow, sanitizePathname } from './lib/config.js';

function readRecords(project) {
  if (!fs.existsSync(project.files.acquisitionRecords)) return [];
  return fs
    .readFileSync(project.files.acquisitionRecords, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function extractTitle(html) {
  const match = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
  return match ? match[1].trim() : null;
}

function extractSections(html) {
  const sections = [];
  const pattern = /<(header|nav|main|section|article|aside|footer)\b([^>]*)>/gi;
  let match;
  let index = 0;
  while ((match = pattern.exec(html)) !== null) {
    const attrs = match[2] || '';
    const id = /\bid="([^"]+)"/i.exec(attrs)?.[1] || null;
    const className = /\bclass="([^"]+)"/i.exec(attrs)?.[1] || null;
    sections.push({
      sectionId: id || `${match[1].toLowerCase()}-${index}`,
      semanticRole: match[1].toLowerCase(),
      suggestedName: className ? className.split(' ')[0] : null,
      classification: 'captured',
    });
    index += 1;
  }
  return sections;
}

function extractDesignTokens(project, records) {
  const customProps = {};
  const colors = new Set();
  const fontFamilies = new Set();
  for (const record of records) {
    if (record.kind !== 'css' || !record.localPath) continue;
    const abs = path.join(project.outputDir, record.localPath);
    if (!fs.existsSync(abs)) continue;
    const css = fs.readFileSync(abs, 'utf8');
    for (const match of css.matchAll(/(--[a-zA-Z0-9-_]+)\s*:\s*([^;]+);/g)) {
      customProps[match[1]] = match[2].trim();
    }
    for (const match of css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) colors.add(match[0].toLowerCase());
    for (const match of css.matchAll(/font-family\s*:\s*([^;]+);/gi)) fontFamilies.add(match[1].trim());
  }
  return {
    generatedAt: isoNow(),
    classification: 'approximated',
    note: 'Extração heurística de MVP. Revisar antes de usar como tokens oficiais.',
    customProperties: customProps,
    colors: [...colors].slice(0, 64),
    fontFamilies: [...fontFamilies].slice(0, 16),
  };
}

function main() {
  const args = parseArgs(process.argv);
  const project = resolveProject(args.config || 'mirror.config.yaml');
  const scope = requireScopeLock(project);
  const records = readRecords(project);

  const pages = scope.routes.include.map((routePath) => {
    const viewportName = scope.viewports?.[0]?.name || 'desktop';
    const snapshotTag = `${routePath === '/' ? 'index' : sanitizePathname(routePath)}-${viewportName}.html`;
    const snapshotPath = path.join(project.dirs.snapshots, snapshotTag);
    const html = fs.existsSync(snapshotPath) ? fs.readFileSync(snapshotPath, 'utf8') : '';
    const pageAssets = records.filter((r) => r.routeDiscovered === routePath && r.localPath);
    return {
      path: routePath,
      title: extractTitle(html),
      pageType: 'unknown',
      sections: extractSections(html).map((s) => s.sectionId),
      dependencies: pageAssets.map((a) => a.sourceUrl),
      assetCount: pageAssets.length,
      classification: 'captured',
    };
  });

  const firstViewportName = scope.viewports?.[0]?.name || 'desktop';
  const firstPageHtmlPath = path.join(project.dirs.snapshots, `index-${firstViewportName}.html`);
  const sections = fs.existsSync(firstPageHtmlPath) ? extractSections(fs.readFileSync(firstPageHtmlPath, 'utf8')) : [];

  const media = records.filter((r) => ['video', 'audio', 'image', 'model'].includes(r.kind) && r.localPath);
  const blocked = fs.existsSync(path.join(project.dirs.logs, 'blocked-external.jsonl'))
    ? fs.readFileSync(path.join(project.dirs.logs, 'blocked-external.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    : [];
  const blockedHosts = [...new Set(blocked.map((b) => new URL(b.url).hostname))];

  writeJson(path.join(project.dirs.blueprint, 'pages.json'), { generatedAt: isoNow(), pages });
  writeJson(path.join(project.dirs.blueprint, 'sections.json'), {
    generatedAt: isoNow(),
    source: 'index (desktop)',
    sections,
    note: 'Mapa estrutural por tags semânticas. Posições e comportamento sticky exigem análise frame a frame (pós-MVP).',
  });
  writeJson(path.join(project.dirs.blueprint, 'design-tokens.json'), extractDesignTokens(project, records));
  writeJson(path.join(project.dirs.blueprint, 'media.json'), {
    generatedAt: isoNow(),
    items: media.map((m) => ({
      kind: m.kind,
      sourceUrl: m.sourceUrl,
      localPath: m.localPath,
      sizeBytes: m.sizeBytes,
      classification: m.classification,
    })),
  });
  writeJson(path.join(project.dirs.blueprint, 'dependencies.json'), {
    generatedAt: isoNow(),
    capturedHosts: [...new Set(records.map((r) => new URL(r.sourceUrl).hostname))].map((host) => ({
      host,
      classification: 'approved-local',
    })),
    externalBlockedHosts: blockedHosts.map((host) => ({ host, classification: 'blocked' })),
  });

  const skeleton = (name) => ({
    generatedAt: isoNow(),
    classification: 'unexercised',
    note: `${name}: análise frame a frame e observação de animações são pós-MVP. Nenhum dado declarado como completo.`,
    items: [],
  });
  writeJson(path.join(project.dirs.blueprint, 'animations.json'), skeleton('animations'));
  writeJson(path.join(project.dirs.blueprint, 'scroll-map.json'), skeleton('scroll-map'));
  writeJson(path.join(project.dirs.blueprint, 'components.json'), skeleton('components'));

  const webglAssets = records.filter((r) => ['model', 'wasm'].includes(r.kind));
  writeJson(path.join(project.dirs.blueprint, 'three-scene.json'), {
    generatedAt: isoNow(),
    classification: webglAssets.length > 0 ? 'approximated' : 'unexercised',
    webglSignals: webglAssets.map((r) => r.sourceUrl),
    note: 'Inspeção profunda de WebGL/Three.js é pós-MVP (PH-003).',
  });

  writeJson(path.join(project.dirs.blueprint, 'responsive-map.json'), {
    generatedAt: isoNow(),
    classification: 'captured',
    viewports: scope.viewports,
    note: 'Screenshots por viewport disponíveis em capture/screenshots/. Comparação visual automática é pós-MVP.',
  });

  console.log('[BLUEPRINT] Experience Blueprint inicial gerado em experience-blueprint/');
  console.log(`  Páginas: ${pages.length} | Mídia: ${media.length} | Hosts bloqueados: ${blockedHosts.length}`);
}

main();
