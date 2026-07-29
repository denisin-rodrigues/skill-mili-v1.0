#!/usr/bin/env node
// RecreationEngineer (A-010 / PH-004): materializa uma fatia editável a partir
// de um plano explícito e evidências já autorizadas.
// Usage: node scripts/recreate.js --config mirror.config.yaml --plan recreation-plan.json [--output recreation]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, requireScopeLock, resolveProject } from './lib/config.js';
import { EXIT, failWith } from './lib/exit-codes.js';
import { createRecreationProject, validateRecreationPlan } from './lib/recreation.js';
import { isWithin } from './lib/safe-path.js';

function main() {
  const args = parseArgs(process.argv);
  if (!args.config || !args.plan) {
    failWith(
      EXIT.INVALID_CONFIG,
      'Uso: node scripts/recreate.js --config <mirror.config.yaml> --plan <recreation-plan.json> [--output recreation]',
    );
  }

  const project = resolveProject(args.config);
  requireScopeLock(project);

  const planPath = path.resolve(String(args.plan));
  if (!isWithin(project.outputDir, planPath)) {
    failWith(EXIT.INVALID_CONFIG, 'O plano de Recreation deve permanecer dentro da raiz autorizada do projeto.');
  }
  if (!fs.existsSync(planPath)) {
    failWith(EXIT.INVALID_CONFIG, `Plano de Recreation não encontrado: ${planPath}`);
  }

  let plan;
  try {
    plan = validateRecreationPlan(JSON.parse(fs.readFileSync(planPath, 'utf8')));
  } catch (error) {
    failWith(EXIT.INVALID_CONFIG, error.message);
  }

  const validation = fs.existsSync(project.files.validationResults)
    ? JSON.parse(fs.readFileSync(project.files.validationResults, 'utf8'))
    : null;
  const level = validation?.classification?.acceptanceLevel || null;
  if (!['L0', 'L1'].includes(level) && !args.requested) {
    failWith(
      EXIT.INVALID_CONFIG,
      'Editable Recreation automática exige mirror L0/L1. Para pedido explícito do usuário, informe --requested.',
    );
  }

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const templateRoot = path.resolve(scriptDir, '..', 'templates', 'recreation-studio');
  const result = createRecreationProject({
    project,
    plan,
    templateRoot,
    output: args.output ? String(args.output) : 'recreation',
  });

  console.log('\n[RECREATE] Primeira fatia editável gerada.');
  console.log(`  Classificação: ${result.state.classification}`);
  console.log(`  Escopo: ${result.state.scope.join(', ')}`);
  console.log(`  Projeto: ${result.recreationRoot}`);
  console.log('  Próximo gate: npm ci → npm run build → validação desktop/mobile/reduced-motion.');
}

try {
  main();
} catch (error) {
  failWith(EXIT.INTERNAL_ERROR, `[RECREATE] Falha fatal: ${error.message}`);
}
