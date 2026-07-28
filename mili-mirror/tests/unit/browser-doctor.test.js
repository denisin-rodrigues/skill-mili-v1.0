import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('doctor --browsers gera diagnóstico Chromium/CDP sem duplicar fontes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ntm-browser-doctor-'));
  try {
    fs.writeFileSync(
      path.join(dir, 'mirror.config.yaml'),
      `config_version: 1
project:
  name: browser-doctor
  output_dir: .
source:
  url: https://example.com
  authorized_domains: [example.com]
routes:
  include: [/]
viewports:
  - { name: desktop, width: 1440, height: 900 }
`,
    );

    const result = spawnSync(
      process.execPath,
      [path.join(SKILL_ROOT, 'scripts', 'doctor.js'), '--config', 'mirror.config.yaml', '--browsers'],
      { cwd: dir, encoding: 'utf8', timeout: 120000 },
    );
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

    const report = JSON.parse(fs.readFileSync(path.join(dir, 'capture', 'environment-report.json'), 'utf8'));
    assert.equal(report.checks.chromium.ok, true);
    assert.equal(report.browsers.playwrightChromium.available, true);
    assert.equal(report.browsers.playwrightChromium.cdpAvailable, true);
    assert.equal(report.checks.chromium.value, report.browsers.playwrightChromium.version);
    assert.match(result.stdout, /Estratégia de navegadores/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
