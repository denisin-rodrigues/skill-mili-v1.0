import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import {
  profileRoot,
  assertExclusiveProfileDir,
  createCleanContext,
  createPersistentContext,
  cleanProfiles,
  listProfiles,
} from '../../browser/context-factory.js';

let browser;
let tmp;

async function setup() {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ntm-ctx-'));
  if (!browser) browser = await chromium.launch({ headless: true });
  return { tmp, browser };
}

test('clean context: isolamento total de storage entre contextos', async () => {
  await setup();
  const a = await createCleanContext(browser, { viewport: { width: 800, height: 600 } });
  const b = await createCleanContext(browser, { viewport: { width: 800, height: 600 } });
  await a.route('http://example.test/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html>' }));
  await b.route('http://example.test/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html>' }));
  const pageA = await a.newPage();
  await pageA.goto('http://example.test/');
  await pageA.evaluate(() => {
    localStorage.setItem('secret', 'A');
    document.cookie = 'k=v';
  });
  const pageB = await b.newPage();
  await pageB.goto('http://example.test/');
  const storageB = await pageB.evaluate(() => localStorage.getItem('secret'));
  const cookiesB = await b.cookies();
  assert.equal(storageB, null, 'localStorage isolado entre contextos clean');
  assert.equal(cookiesB.length, 0, 'cookies isolados');
  await a.close();
  await b.close();
});

test('perfil persistente fica no diretório exclusivo do Mili', async () => {
  const { tmp: outputDir } = await setup();
  const { context, dir } = await createPersistentContext(chromium, {
    outputDir,
    profileName: 'warm',
    viewport: { width: 800, height: 600 },
  });
  assert.ok(dir.startsWith(profileRoot(outputDir)), 'perfil dentro da raiz exclusiva');
  assert.ok(fs.existsSync(dir));
  await context.close();
  assert.ok(listProfiles(outputDir).some((p) => p.endsWith('warm')));
  fs.rmSync(outputDir, { recursive: true, force: true });
});

test('guarda: rejeita diretório fora da área exclusiva e perfil pessoal', async () => {
  const { tmp: outputDir } = await setup();
  assert.throws(() => assertExclusiveProfileDir(outputDir, '../chrome-profile'), /fora da área exclusiva/);
  const personal = path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Default');
  assert.throws(() => assertExclusiveProfileDir(outputDir, personal), /perfil pessoal|fora da área exclusiva/);
  await assert.rejects(
    () => createPersistentContext(chromium, { outputDir, profileName: '../../etc/passwd' }),
    /fora da área exclusiva/,
  );
  fs.rmSync(outputDir, { recursive: true, force: true });
});

test('cleanProfiles remove apenas o diretório exclusivo', async () => {
  const { tmp: outputDir } = await setup();
  const { context } = await createPersistentContext(chromium, { outputDir, profileName: 'warm', viewport: { width: 800, height: 600 } });
  await context.close();
  const sentinel = path.join(outputDir, 'sentinel.txt');
  fs.writeFileSync(sentinel, 'nao-tocar');
  const result = cleanProfiles(outputDir);
  assert.equal(result.removed, true);
  assert.equal(fs.existsSync(profileRoot(outputDir)), false);
  assert.equal(fs.existsSync(sentinel), true, 'arquivos fora do profileRoot são preservados');
  assert.equal(cleanProfiles(outputDir).removed, false, 'idempotente');
  fs.rmSync(outputDir, { recursive: true, force: true });
});

test('cleanup global do browser', async () => {
  if (browser) await browser.close();
});
