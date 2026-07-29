#!/usr/bin/env node
// RecreationEngineer (A-010 / PH-004): atualiza conteúdo/tema/estado de uma Recreation
// já gerada quando o plano evolui (ex.: cases adicionados após a fatia inicial).
// Nunca sobrescreve scaffold (App.tsx, estilos, package.json).
// Usage: node scripts/update-recreation-content.js --config mirror.config.yaml --plan recreation-plan.json [--output recreation]
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, requireScopeLock, resolveProject } from './lib/config.js';
import { EXIT, failWith } from './lib/exit-codes.js';
import { updateRecreationContent, validateRecreationPlan } from './lib/recreation.js';
import { isWithin } from './lib/safe-path.js';

function main() {
  const args = parseArgs(process.argv);
  if (!args.config || !args.plan) {
    failWith(
      EXIT.INVALID_CONFIG,
      'Uso: node scripts/update-recreation-content.js --config <mirror.config.yaml> --plan <recreation-plan.json> [--output recreation]',
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

  const result = updateRecreationContent({
    project,
    plan,
    output: args.output ? String(args.output) : 'recreation',
  });

  console.log('\n[RECREATE:UPDATE] Conteúdo, tema e estado atualizados a partir do plano.');
  console.log(`  Escopo: ${result.state.scope.join(', ')}`);
  console.log(`  Case routes: ${result.state.caseRoutes.join(', ') || 'nenhuma'}`);
  console.log(`  Não implementado: ${result.state.notImplemented.join(', ')}`);
  console.log(`  Projeto: ${result.recreationRoot}`);
  console.log('  Próximo gate: npm run build dentro de recreation → node scripts/validate-recreation.js.');
}

try {
  main();
} catch (error) {
  failWith(EXIT.INTERNAL_ERROR, `[RECREATE:UPDATE] Falha fatal: ${error.message}`);
}
