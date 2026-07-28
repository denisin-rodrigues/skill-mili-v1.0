import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { decodeRepeatedly, hasTraversal, isWithin, resolveWithin, resolveHttpPathname } from '../../scripts/lib/safe-path.js';

let tmp;
let root;
function setup() {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ntm-safepath-'));
  root = path.join(tmp, 'root');
  fs.mkdirSync(path.join(root, 'assets', 'img'), { recursive: true });
  fs.writeFileSync(path.join(root, 'assets', 'img', 'a.png'), 'A');
  fs.writeFileSync(path.join(tmp, 'outside.txt'), 'SECRET');
  return { tmp, root };
}
function teardown() {
  fs.rmSync(tmp, { recursive: true, force: true });
}

test('decodeRepeatedly: encoding simples, duplo e triplo', () => {
  assert.equal(decodeRepeatedly('%2e%2e'), '..');
  assert.equal(decodeRepeatedly('%252e%252e'), '..');
  assert.equal(decodeRepeatedly('%25252e%25252e'), '..');
  assert.equal(decodeRepeatedly('normal.png'), 'normal.png');
  assert.equal(decodeRepeatedly('%ZZ'), '%ZZ'); // malformado: preserva
});

test('hasTraversal: variantes de traversal', () => {
  assert.equal(hasTraversal('../x'), true);
  assert.equal(hasTraversal('..\\x'), true);
  assert.equal(hasTraversal('a/../../b'), true);
  assert.equal(hasTraversal('%2e%2e/x'), true);
  assert.equal(hasTraversal('%252e%252e/x'), true);
  assert.equal(hasTraversal('/assets/../secret'), true);
  assert.equal(hasTraversal('/assets/img/a.png'), false);
  assert.equal(hasTraversal('/a..b/c.png'), false, 'segmento "..x" não é traversal');
});

test('resolveWithin: bloqueia todos os escapes', () => {
  const { root } = setup();
  try {
    for (const input of ['../outside.txt', '..\\outside.txt', 'assets/../../outside.txt', '%2e%2e/outside.txt', '%252e%252e/outside.txt']) {
      const r = resolveWithin(root, input);
      assert.equal(r.ok, false, `${input} deveria falhar`);
    }
    // caminhos absolutos nunca são aceitos como input
    const absNix = resolveWithin(root, '/etc/passwd');
    assert.equal(absNix.ok, false);
    if (!absNix.ok) assert.equal(absNix.reason, 'absolute-path');
    const absWin = resolveWithin(root, 'C:\\Windows\\win.ini');
    assert.equal(absWin.ok, false);
    if (!absWin.ok) assert.equal(absWin.reason, 'absolute-path');
  } finally {
    teardown();
  }
});

test('resolveWithin: prefixos parecidos não enganam', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'ntm-prefix-'));
  const rootDir = path.join(base, 'root');
  const evil = path.join(base, 'rootevil');
  fs.mkdirSync(rootDir, { recursive: true });
  fs.mkdirSync(evil, { recursive: true });
  try {
    assert.equal(isWithin(rootDir, path.join(evil, 'x.txt')), false, 'rootevil não está dentro de root');
    assert.equal(isWithin(rootDir, rootDir), true);
    assert.equal(isWithin(rootDir, path.join(rootDir, 'sub', 'x.txt')), true);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('resolveWithin: caminhos normais autorizados e Unicode', () => {
  const { root } = setup();
  try {
    const ok = resolveWithin(root, 'assets/img/a.png');
    assert.equal(ok.ok, true);
    assert.ok(fs.existsSync(ok.abs));
    const uni = resolveWithin(root, 'assets/espaço-日本.png');
    assert.equal(uni.ok, true); // não existe ainda, mas o caminho é seguro
    const sep = resolveWithin(root, 'assets\\img\\a.png');
    assert.equal(sep.ok, true, 'separador Windows normalizado');
  } finally {
    teardown();
  }
});

test('resolveWithin: symlink/junction escapando da raiz é bloqueado', (t) => {
  const { tmp: base, root: rootDir } = setup();
  const linkPath = path.join(rootDir, 'assets', 'link-out');
  try {
    fs.symlinkSync(base, linkPath, 'junction'); // junction não exige admin no Windows
  } catch (err) {
    t.skip(`ambiente não suporta symlink/junction: ${err.message}`);
    return;
  }
  try {
    const r = resolveWithin(rootDir, 'assets/link-out/outside.txt');
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'symlink-escapes-root');
  } finally {
    teardown();
  }
});

test('resolveHttpPathname: inspeção raw antes de qualquer normalização', () => {
  const okCase = resolveHttpPathname('/assets/img/a.png?v=1');
  assert.equal(okCase.ok, true);
  if (okCase.ok) assert.equal(okCase.pathname, '/assets/img/a.png');

  const expectReason = (input, reason) => {
    const r = resolveHttpPathname(input);
    assert.equal(r.ok, false, `${input} deveria falhar`);
    if (!r.ok) assert.equal(r.reason, reason);
  };
  expectReason('/../../../etc/passwd', 'traversal');
  expectReason('/..\\..\\win.ini', 'traversal');
  expectReason('/%2e%2e/%2e%2e/x', 'traversal');
  expectReason('/%252e%252e%252f%252e%252e%252fx', 'traversal');
  expectReason('/a%00b.png', 'null-byte');
  expectReason('sem-barra', 'not-rooted');
});
