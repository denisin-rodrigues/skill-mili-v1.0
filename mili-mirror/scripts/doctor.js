#!/usr/bin/env node
// EnvironmentBootstrap (A-002): diagnoses the local environment.
// Usage: node scripts/doctor.js [--config mirror.config.yaml]
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import { promisify } from 'node:util';
import { parseArgs, resolveProject, writeJson, ensureDir, isoNow } from './lib/config.js';

const run = promisify(execFile);

async function tryVersion(cmd, args = ['--version']) {
  try {
    const { stdout } = await run(cmd, args, { timeout: 10000 });
    return stdout.trim().split('\n')[0];
  } catch {
    return null;
  }
}

async function portFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, '127.0.0.1');
  });
}

async function checkChromium() {
  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    const version = browser.version();
    await browser.close();
    return version;
  } catch (err) {
    return null;
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const report = {
    checkedAt: isoNow(),
    platform: process.platform,
    arch: process.arch,
    isWSL: os.release().toLowerCase().includes('microsoft'),
    node: process.version,
    checks: {},
    ok: true,
  };

  const nodeMajor = Number(process.versions.node.split('.')[0]);
  report.checks.node = { value: process.version, ok: nodeMajor >= 18 };

  report.checks.npm = { value: (await tryVersion('npm')) || (await tryVersion('npm.cmd')), ok: true };
  report.checks.git = { value: await tryVersion('git'), ok: true, required: false };
  report.checks.ffmpeg = { value: await tryVersion('ffmpeg', ['-version']), ok: true, required: false };
  report.checks.python3 = { value: await tryVersion('python3'), ok: true, required: false };
  report.checks.docker = { value: await tryVersion('docker'), ok: true, required: false };

  console.log('[DOCTOR] Verificando navegador Chromium (Playwright)...');
  const chromiumVersion = await checkChromium();
  report.checks.chromium = { value: chromiumVersion, ok: Boolean(chromiumVersion) };

  try {
    const stats = fs.statfsSync(os.tmpdir());
    const freeGb = (stats.bavail * stats.bsize) / 1024 ** 3;
    report.checks.disk = { value: `${freeGb.toFixed(1)} GB livres`, ok: freeGb >= 2 };
  } catch {
    report.checks.disk = { value: 'indisponível', ok: true, required: false };
  }

  report.checks.port4173 = { value: (await portFree(4173)) ? 'livre' : 'ocupada', ok: true, required: false };

  for (const [name, check] of Object.entries(report.checks)) {
    const required = check.required !== false;
    if (required && !check.ok) report.ok = false;
    const icon = check.ok ? 'OK ' : 'FALHA';
    console.log(`  [${icon}] ${name}: ${check.value ?? 'não encontrado'}`);
  }

  if (args.config) {
    const project = resolveProject(args.config);
    ensureDir(project.dirs.capture);
    writeJson(`${project.dirs.capture}/environment-report.json`, report);
    fs.writeFileSync(
      `${project.dirs.capture}/runtime-versions.lock`,
      [`node=${process.version}`, `chromium=${chromiumVersion || 'missing'}`, `checkedAt=${report.checkedAt}`].join('\n'),
      'utf8',
    );
    console.log(`  Relatório: ${project.dirs.capture}/environment-report.json`);
  }

  if (!report.ok) {
    console.error('\n[DOCTOR] Ambiente incompleto. Rode install/linux/install.sh (Linux/WSL) ou install/windows/install-wsl.ps1.');
    process.exit(1);
  }
  console.log('\n[DOCTOR] Ambiente pronto.');
}

main();
