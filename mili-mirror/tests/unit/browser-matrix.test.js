import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { upsertPass, readMatrix, PASS_STATUS } from '../../browser/matrix.js';
import { detectChromeStable } from '../../browser/detect.js';
import { decideSecondaryRun } from '../../browser/browser-policy.js';
import { EXIT } from '../../scripts/lib/exit-codes.js';

const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function makeProject() {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ntm-matrix-'));
  return { outputDir, dirs: { capture: path.join(outputDir, 'capture') } };
}

test('matrix: upsert insere e substitui por id, ordenado', () => {
  const project = makeProject();
  upsertPass(project, { id: 'firefox-compatibility', order: 6, engine: 'firefox', status: PASS_STATUS.DISABLED, officialAcquisition: false });
  upsertPass(project, { id: 'chromium-clean-discovery', order: 1, engine: 'chromium', status: PASS_STATUS.PASSED, officialAcquisition: true });
  upsertPass(project, { id: 'chromium-clean-discovery', order: 1, engine: 'chromium', status: PASS_STATUS.FAILED, officialAcquisition: true });
  const matrix = readMatrix(project);
  assert.equal(matrix.passes.length, 2, 'substitui por id');
  assert.equal(matrix.passes[0].id, 'chromium-clean-discovery', 'ordenado por order');
  assert.equal(matrix.passes[0].status, 'failed');
  assert.equal(matrix.acquisitionSource, 'playwright-chromium');
  fs.rmSync(project.outputDir, { recursive: true, force: true });
});

test('matrix: rejeita passe que não existe na política central', () => {
  const project = makeProject();
  assert.throws(
    () => upsertPass(project, { id: 'chromium-online-validation', engine: 'chromium', status: PASS_STATUS.PASSED, officialAcquisition: false }),
    /Passe de navegador não modelado/,
  );
  fs.rmSync(project.outputDir, { recursive: true, force: true });
});

test('validate --browser inválido → 2 (INVALID_CONFIG)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ntm-badbrowser-'));
  fs.writeFileSync(path.join(dir, 'mirror.config.yaml'), 'project:\n  name: x\n  output_dir: .\n');
  const r = spawnSync(process.execPath, [path.join(SKILL_ROOT, 'scripts', 'validate.js'), '--config', 'mirror.config.yaml', '--browser', 'netscape'], {
    cwd: dir,
    encoding: 'utf8',
    timeout: 60000,
  });
  assert.equal(r.status, EXIT.INVALID_CONFIG);
  assert.match(`${r.stdout}${r.stderr}`, /--browser inválido/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('detecção Chrome Stable: formato seguro do resultado (sem paths fixos)', async () => {
  const result = await detectChromeStable();
  if (result.available) {
    assert.equal(typeof result.version, 'string');
    assert.equal(result.channel, 'chrome');
  } else {
    assert.equal(result.available, false);
    assert.match(result.reason, /not installed/i);
  }
  // Nunca retorna caminhos absolutos de máquina específica
  assert.equal(JSON.stringify(result).includes('Program Files'), false);
});

test('chrome obrigatório e ausente → decisão fail', () => {
  assert.equal(decideSecondaryRun({ available: false, reason: 'not installed' }, { required: true, enabled: true }), 'fail');
});
