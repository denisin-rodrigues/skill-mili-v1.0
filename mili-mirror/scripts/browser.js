#!/usr/bin/env node
// Browser profile management (Milestone: Browser Runtime Strategy).
// Usage: node scripts/browser.js clean-profiles --config mirror.config.yaml
//        node scripts/browser.js list-profiles --config mirror.config.yaml
import { parseArgs, resolveProject } from './lib/config.js';
import { cleanProfiles, listProfiles, profileRoot } from '../browser/context-factory.js';
import { EXIT, failWith } from './lib/exit-codes.js';

const args = parseArgs(process.argv);
const command = args._[0];

if (!command || !['clean-profiles', 'list-profiles'].includes(command)) {
  console.log('Uso: node scripts/browser.js <clean-profiles|list-profiles> --config mirror.config.yaml');
  process.exit(EXIT.INVALID_CONFIG);
}

try {
  const project = resolveProject(args.config || 'mirror.config.yaml');
  if (command === 'clean-profiles') {
    const result = cleanProfiles(project.outputDir);
    if (result.removed) {
      console.log(`[BROWSER] Perfis removidos: ${result.dir} (${(result.freedBytes / 1024).toFixed(1)} KB liberados)`);
      console.log('[BROWSER] Apenas o diretório exclusivo do Mili foi afetado; perfis pessoais nunca são tocados.');
    } else {
      console.log(`[BROWSER] Nenhum perfil para limpar em ${result.dir}`);
    }
  } else {
    const profiles = listProfiles(project.outputDir);
    console.log(`[BROWSER] Diretório de perfis: ${profileRoot(project.outputDir)}`);
    if (profiles.length === 0) console.log('[BROWSER] Nenhum perfil persistente.');
    for (const p of profiles) console.log(`  - ${p}`);
  }
} catch (err) {
  failWith(EXIT.INVALID_CONFIG, `[BROWSER] ${err.message}`);
}
