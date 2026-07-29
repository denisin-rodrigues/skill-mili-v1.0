import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'node:test';
import { acquireRecreationMedia, validateRecreationMediaPlan } from '../../scripts/lib/recreation-media.js';

const roots = [];

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mili-recreation-media-'));
  roots.push(root);
  return root;
}

function mediaPlan(overrides = {}) {
  return {
    version: 1,
    items: [
      {
        sourceUrl: 'https://storage.googleapis.com/example/project.jpg',
        target: 'projects/project.jpg',
        alt: 'Imagem do projeto',
        contentType: 'image/jpeg',
      },
    ],
    ...overrides,
  };
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

test('valida HTTPS, target único e texto alternativo', () => {
  const plan = mediaPlan();
  assert.equal(validateRecreationMediaPlan(plan), plan);
  assert.throws(
    () => validateRecreationMediaPlan(mediaPlan({ items: [{ sourceUrl: 'http://example.com/a.jpg', target: 'a.jpg', alt: 'A' }] })),
    /HTTPS/,
  );
  assert.throws(
    () => validateRecreationMediaPlan(mediaPlan({ items: [plan.items[0], { ...plan.items[0] }] })),
    /target duplicado/,
  );
});

test('reutiliza arquivo existente sem sobrescrever e registra hash', async () => {
  const root = makeRoot();
  const target = path.join(root, 'recreation-media', 'projects', 'project.jpg');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, 'existing-image');
  const project = {
    outputDir: root,
    config: { capture: { max_total_download_gb: 0.01 } },
    scope: { authorizationHash: 'sha256:test' },
  };
  const report = await acquireRecreationMedia({
    project,
    plan: mediaPlan(),
    allowlist: { isAllowed: () => true },
  });

  assert.equal(report.records[0].reusedExisting, true);
  assert.equal(report.records[0].classification, 'captured');
  assert.match(report.records[0].sha256, /^[a-f0-9]{64}$/);
  assert.equal(fs.readFileSync(target, 'utf8'), 'existing-image');
});

test('bloqueia URL fora da allowlist e destino escapando da raiz', async () => {
  const root = makeRoot();
  const project = { outputDir: root, config: {}, scope: {} };
  await assert.rejects(
    acquireRecreationMedia({ project, plan: mediaPlan(), allowlist: { isAllowed: () => false } }),
    /fora da allowlist/,
  );
  await assert.rejects(
    acquireRecreationMedia({
      project,
      plan: mediaPlan({ items: [{ ...mediaPlan().items[0], target: '../escape.jpg' }] }),
      allowlist: { isAllowed: () => true },
    }),
    /Destino de mídia inválido/,
  );
});
