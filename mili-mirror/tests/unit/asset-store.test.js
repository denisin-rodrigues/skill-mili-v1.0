import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assetLocation, AssetRegistry, localUrlFor } from '../../scripts/lib/asset-store.js';

test('variantes de query produzem caminhos locais distintos e determinísticos', () => {
  const a = assetLocation(new URL('https://example.com/image.webp?w=640'), 'image/webp');
  const b = assetLocation(new URL('https://example.com/image.webp?w=1280'), 'image/webp');
  const c = assetLocation(new URL('https://example.com/image.webp?format=avif'), 'image/webp');
  assert.notEqual(a.localRel, b.localRel);
  assert.notEqual(a.localRel, c.localRel);
  assert.notEqual(b.localRel, c.localRel);
  // determinístico: mesma URL canônica → mesmo caminho
  assert.equal(assetLocation(new URL('https://example.com/image.webp?w=640'), 'image/webp').localRel, a.localRel);
  assert.match(a.localRel, /__q_[a-f0-9]{10}\.webp$/);
  assert.equal(a.requestPath, '/image.webp');
  assert.equal(a.requestQuery, 'w=640');
});

test('assets sem query não recebem sufixo de hash', () => {
  const loc = assetLocation(new URL('https://example.com/css/style.css'), 'text/css');
  assert.equal(loc.localRel, 'mirror/assets/example.com/css/style.css');
  assert.equal(loc.requestQuery, '');
});

test('caracteres especiais são sanitizados; estrutura de diretórios preservada', () => {
  const loc = assetLocation(new URL('https://example.com/a<b>/c"d/e.png'), 'image/png');
  assert.equal(loc.localRel, 'mirror/assets/example.com/a_b_/c_d/e.png');
  const encoded = assetLocation(new URL('https://example.com/dir/espa%C3%A7o.png'), 'image/png');
  assert.equal(encoded.localRel, 'mirror/assets/example.com/dir/espaço.png');
});

test('colisão de sanitização é resolvida deterministicamente', () => {
  const registry = new AssetRegistry();
  const first = registry.register(new URL('https://example.com/a<b.png'), 'image/png', { kind: 'image' });
  const second = registry.register(new URL('https://example.com/a>b.png'), 'image/png', { kind: 'image' });
  assert.notEqual(first.localRel, second.localRel);
  assert.match(second.localRel, /__c_[a-f0-9]{10}\.png$/);
  // mesma URL registrada duas vezes retorna a mesma entrada
  assert.equal(registry.register(new URL('https://example.com/a<b.png'), 'image/png', {}), first);
});

test('localUrlFor codifica e anexa fragmento', () => {
  const loc = /** @type {import('../../scripts/lib/asset-store.js').AssetEntry} */ (/** @type {unknown} */ (assetLocation(new URL('https://example.com/dir/espaço.svg'), 'image/svg+xml')));
  const url = localUrlFor(loc, 'icon-star');
  assert.equal(url, '/__assets/example.com/dir/espa%C3%A7o.svg#icon-star');
  const noFrag = localUrlFor(loc);
  assert.equal(noFrag, '/__assets/example.com/dir/espa%C3%A7o.svg');
});
