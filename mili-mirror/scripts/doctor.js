#!/usr/bin/env node
// EnvironmentBootstrap (A-002): diagnoses the local environment.
// Usage: node scripts/doctor.js [--config mirror.config.yaml]
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import { promisify } from 'node:util';
import { parseArgs, resolveProject, writeJson, ensureDir, isoNow } from './lib/config.js';
import { EXIT, failWith } from './lib/exit-codes.js';
import { detectPlaywrightChromium, detectChromeStable, detectFirefox, playwrightVersion } from '../browser/detect.js';
import { resolveBrowserPolicy } from '../browser/browser-policy.js';
import { profileRoot, listProfiles } from '../browser/context-factory.js';

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
  const playwrightChromium = await detectPlaywrightChromium();
  const chromiumVersion = playwrightChromium.available ? playwrightChromium.version : null;
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

  // ---- Browser runtime strategy (mili doctor --browsers) ----
  if (args.browsers) {
    console.log('\n[DOCTOR] Estratégia de navegadores:');
    const project = args.config ? resolveProject(args.config) : null;
    const policy = resolveBrowserPolicy(project?.config || {});
    const browsers = {};

    const pw = playwrightChromium;
    browsers.playwrightChromium = pw;
    if (pw.available) {
      console.log(`  [OK] Playwright Chromium ${pw.version} (playwright ${pw.playwrightVersion}) — obrigatório`);
      console.log(`  [${pw.cdpAvailable ? 'OK' : 'FALHA'}] CDP disponível: ${pw.cdpAvailable}`);
      if (!pw.cdpAvailable) report.ok = false;
    } else {
      console.log(`  [FALHA] Playwright Chromium — obrigatório e indisponível: ${pw.reason}`);
      report.ok = false;
    }

    const chrome = await detectChromeStable();
    browsers.chromeStable = chrome;
    if (chrome.available) {
      console.log(`  [OK] Chrome Stable ${chrome.version} — validação secundária opcional`);
    } else {
      const state = policy.productionValidation.required ? 'FALHA' : 'SKIP';
      console.log(`  [${state}] Chrome Stable — ${policy.productionValidation.required ? 'obrigatório e ausente' : 'opcional e não instalado'}`);
      if (policy.productionValidation.required) report.ok = false;
    }

    if (policy.compatibility.firefox.enabled) {
      const ff = await detectFirefox();
      browsers.firefox = ff;
      console.log(`  [${ff.available ? 'OK' : 'SKIP'}] Firefox compatibility — ${ff.available ? ff.version : 'opcional e não instalado'}`);
    } else {
      console.log('  [DISABLED] Firefox compatibility');
    }
    console.log('  [RESERVED] WebKit');
    console.log('  [UNSUPPORTED AS ACQUISITION] Brave');

    const profilesDir = project ? profileRoot(project.outputDir) : '(sem --config)';
    const profiles = project ? listProfiles(project.outputDir) : [];
    browsers.profilesDir = project ? profileRoot(project.outputDir) : null;
    browsers.profiles = profiles;
    console.log(`  Perfis Mili: ${profilesDir} (${profiles.length} perfil/is)`);
    report.browsers = browsers;
  }

  if (args.config) {
    const project = resolveProject(args.config);
    ensureDir(project.dirs.capture);
    writeJson(`${project.dirs.capture}/environment-report.json`, report);
    fs.writeFileSync(
      `${project.dirs.capture}/runtime-versions.lock`,
      [`node=${process.version}`, `chromium=${chromiumVersion || 'missing'}`, `playwright=${playwrightVersion()}`, `checkedAt=${report.checkedAt}`].join('\n'),
      'utf8',
    );
    console.log(`  Relatório: ${project.dirs.capture}/environment-report.json`);
  }

  if (!report.ok) {
    failWith(EXIT.DEPENDENCY_MISSING, 'Ambiente incompleto. Rode install/linux/install.sh (Linux/WSL) ou install/windows/install-wsl.ps1.');
  }
  console.log('\n[DOCTOR] Ambiente pronto.');
}

main();
