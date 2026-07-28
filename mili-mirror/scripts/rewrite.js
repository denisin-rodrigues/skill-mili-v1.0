#!/usr/bin/env node
// Runtime Rewriting phase (Milestone: Robust Asset Resolution and Runtime Rewriting).
// Rewrites captured HTML pages, CSS and JS so references resolve locally, and writes
// capture/rewrite-report.json with per-reference evidence.
//
// Usage: node scripts/rewrite.js --config mirror.config.yaml
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, resolveProject, requireScopeLock, writeJson, isoNow } from './lib/config.js';
import { sha256File } from './lib/hash.js';
import { Allowlist } from './lib/allowlist.js';
import { rewriteHtml } from './lib/rewrite/html-rewriter.js';
import { rewriteCss } from './lib/rewrite/css-rewriter.js';
import { rewriteJs } from './lib/rewrite/js-rewriter.js';
import { EXIT, failWith } from './lib/exit-codes.js';

function readRecords(project) {
  if (!fs.existsSync(project.files.acquisitionRecords)) return [];
  return fs
    .readFileSync(project.files.acquisitionRecords, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function main() {
  const args = parseArgs(process.argv);
  const project = resolveProject(args.config || 'mirror.config.yaml');
  const scope = requireScopeLock(project);
  const { config } = project;

  const primaryHost = new URL(scope.source.url).hostname.toLowerCase();
  const allowlist = new Allowlist(scope.domains);
  const routePaths = new Set(scope.routes.include);

  const records = readRecords(project);
  /** @type {Map<string, object>} canonical URL -> captured entry */
  const index = new Map();
  for (const record of records) {
    if (record.classification !== 'captured' || !record.localPath || !record.canonical) continue;
    index.set(record.canonical, {
      localRel: record.localPath,
      kind: record.kind,
      viaRedirect: record.viaRedirect === true,
    });
  }
  if (index.size === 0) {
    failWith(EXIT.INVALID_CONFIG, 'Nenhum recurso capturado encontrado. Execute a captura antes da reescrita.');
  }

  const pagesMetaPath = path.join(project.dirs.capture, 'pages-meta.json');
  const pagesMeta = fs.existsSync(pagesMetaPath) ? JSON.parse(fs.readFileSync(pagesMetaPath, 'utf8')) : [];
  /** @type {'disabled'|'preserve'} */
  const formsMode = config?.interactions?.forms === 'disabled' ? 'disabled' : 'preserve';

  const report = [];
  const stats = { filesProcessed: 0, filesFailed: 0, rewritten: 0, skipped: 0, failed: 0 };

  const originBase = new URL(scope.source.url).origin + '/';
  const makeCtx = (sourceFile, baseUrl) => ({
    sourceFile,
    baseUrl,
    documentBaseUrl: originBase,
    report,
    forms: formsMode,
    lookup: (canonical) => index.get(canonical) || null,
    routeFor: (url) => {
      if (url.hostname.toLowerCase() === primaryHost && routePaths.has(url.pathname)) return url.pathname;
      return null;
    },
    isAuthorized: (url) => allowlist.isAllowed(url.toString()),
  });

  const tally = (from) => {
    for (const entry of from) {
      if (entry.status === 'rewritten') stats.rewritten += 1;
      else if (entry.status === 'skipped') stats.skipped += 1;
      else if (entry.status === 'failed') stats.failed += 1;
    }
  };

  // 1. HTML pages (canonical, first viewport)
  for (const page of pagesMeta) {
    const abs = path.join(project.outputDir, page.file);
    if (!fs.existsSync(abs)) continue;
    const before = report.length;
    try {
      const html = fs.readFileSync(abs, 'utf8');
      const out = rewriteHtml(html, makeCtx(page.file.replaceAll(path.sep, '/'), page.url));
      fs.writeFileSync(abs, out, 'utf8');
      stats.filesProcessed += 1;
    } catch (err) {
      stats.filesFailed += 1;
      report.push({ sourceFile: page.file, originalUrl: page.url, originalValue: null, rewrittenValue: null, referenceType: 'html:file', strategy: 'parse5', confidence: 'high', status: 'failed', reason: err.message });
    }
    tally(report.slice(before));
  }

  // 2. Captured CSS and JS files
  for (const record of records) {
    if (record.classification !== 'captured' || !record.localPath) continue;
    if (!['css', 'js'].includes(record.kind)) continue;
    const abs = path.join(project.outputDir, record.localPath);
    if (!fs.existsSync(abs)) continue;
    const before = report.length;
    try {
      const code = fs.readFileSync(abs, 'utf8');
      const ctx = makeCtx(record.localPath, record.sourceUrl);
      const out = record.kind === 'css' ? await rewriteCss(code, ctx) : rewriteJs(code, ctx);
      fs.writeFileSync(abs, out, 'utf8');
      stats.filesProcessed += 1;
    } catch (err) {
      stats.filesFailed += 1;
      report.push({ sourceFile: record.localPath, originalUrl: record.sourceUrl, originalValue: null, rewrittenValue: null, referenceType: `${record.kind}:file`, strategy: record.kind === 'css' ? 'postcss' : 'acorn', confidence: 'high', status: 'failed', reason: err.message });
    }
    tally(report.slice(before));
  }

  // 3. Rewrite report
  const rewriteReport = {
    generatedAt: isoNow(),
    source: scope.source.url,
    stats,
    entries: report,
  };
  writeJson(path.join(project.dirs.capture, 'rewrite-report.json'), rewriteReport);

  // 4. Regenerate hashes (rewriting changed file contents)
  const hashLines = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else hashLines.push(`${sha256File(full)}  ${path.relative(project.outputDir, full).replaceAll(path.sep, '/')}`);
    }
  };
  walk(project.dirs.mirror);
  fs.writeFileSync(project.files.hashes, `${hashLines.join('\n')}\n`, 'utf8');

  console.log('\n[REWRITE] Concluída.');
  console.log(`  Arquivos processados: ${stats.filesProcessed} | referências reescritas: ${stats.rewritten} | não reescritas: ${stats.skipped} | falhas: ${stats.failed}`);
  console.log(`  Relatório: ${path.join(project.dirs.capture, 'rewrite-report.json')}`);
  // Parse failures and file failures are honest PARTIAL results (V-05), never hidden
  if (stats.filesFailed > 0 || stats.failed > 0) process.exitCode = EXIT.PARTIAL_RESULT;
}

main().catch((err) => {
  if (process.exitCode && process.exitCode !== 0) {
    console.error(`\n[REWRITE] Falha fatal após resultado parcial: ${err.message}`);
    process.exit(process.exitCode);
  }
  failWith(EXIT.INTERNAL_ERROR, `[REWRITE] Falha fatal: ${err.message}`);
});
