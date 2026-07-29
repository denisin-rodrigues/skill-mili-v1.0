#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { Allowlist } from './lib/allowlist.js';
import { parseArgs, requireScopeLock, resolveProject, writeJson } from './lib/config.js';
import { EXIT, failWith } from './lib/exit-codes.js';
import { acquireRecreationMedia, validateRecreationMediaPlan } from './lib/recreation-media.js';
import { isWithin } from './lib/safe-path.js';

async function main() {
  const args = parseArgs(process.argv);
  if (!args.config || !args.plan) {
    failWith(EXIT.INVALID_CONFIG, 'Uso: node scripts/acquire-recreation-media.js --config <config> --plan <media-plan.json>');
  }
  const project = resolveProject(args.config);
  const scope = requireScopeLock(project);
  project.scope = scope;
  const planPath = path.resolve(String(args.plan));
  if (!isWithin(project.outputDir, planPath) || !fs.existsSync(planPath)) {
    failWith(EXIT.INVALID_CONFIG, 'O plano de mídia deve existir dentro da raiz autorizada do projeto.');
  }
  const plan = validateRecreationMediaPlan(JSON.parse(fs.readFileSync(planPath, 'utf8')));
  const report = await acquireRecreationMedia({
    project,
    plan,
    allowlist: new Allowlist(scope.domains),
    output: args.output ? String(args.output) : 'recreation-media',
  });
  const manifestPath = path.join(project.outputDir, report.output, 'media-manifest.json');
  writeJson(manifestPath, report);
  console.log(`\n[RECREATION:MEDIA] ${report.records.length} imagem(ns) adquirida(s), ${report.totalBytes} bytes.`);
  console.log(`  Manifesto: ${manifestPath}`);
}

main().catch((error) => failWith(EXIT.INTERNAL_ERROR, `[RECREATION:MEDIA] Falha: ${error.message}`));
