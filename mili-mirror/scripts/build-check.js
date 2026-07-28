#!/usr/bin/env node
// Build check for the plain-JS ESM project: syntax-checks every project file with
// `node --check` (module goal respected via package.json "type": "module").
// Usage: npm run build
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = ['scripts', 'server', 'tests/unit'];

function collect(dir) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  const out = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js')) out.push(full);
    }
  };
  walk(abs);
  return out;
}

const files = DIRS.flatMap(collect);
let failures = 0;
for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (err) {
    failures += 1;
    console.error(`FALHA  ${path.relative(ROOT, file)}\n${err.stderr?.toString() || err.message}`);
  }
}
console.log(`[BUILD] ${files.length} arquivos verificados, ${failures} falhas.`);
if (failures > 0) {
  const { EXIT, failWith } = await import('./lib/exit-codes.js');
  failWith(EXIT.INTERNAL_ERROR, `${failures} arquivo(s) com erro de sintaxe.`);
}
console.log('[BUILD] Aprovado.');
