// V-03 regression: redirect aliases must point at the final file from registration
// time. Old code mutated entry.localRel AFTER registering, leaving pathOwners with a
// stale entry — a later, unrelated asset mapping to that path got a bogus collision
// suffix. This test fails on the old behavior.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AssetRegistry } from '../../scripts/lib/asset-store.js';

test('V-03: alias forçado no registro não polui o pathOwners', () => {
  const registry = new AssetRegistry();
  const finalEntry = registry.register(new URL('https://example.com/assets/logo.svg'), 'image/svg+xml', { kind: 'image' });

  // Alias de redirect apontando para o arquivo final desde o registro
  const alias = registry.register(new URL('https://example.com/old-logo'), 'image/svg+xml', {
    kind: 'image',
    viaRedirect: true,
    localRel: finalEntry.localRel,
  });
  assert.equal(alias.localRel, finalEntry.localRel);

  // O path que o alias TERIA calculado (/old-logo → mirror/assets/example.com/old-logo.svg)
  // NÃO pode estar registrado como propriedade do alias
  const stalePath = 'mirror/assets/example.com/old-logo.svg';
  assert.notEqual(registry.pathOwners.get(stalePath), alias.canonical);

  // Um asset novo e legítimo que calcula exatamente esse path NÃO pode receber sufixo de colisão
  const newcomer = registry.register(new URL('https://example.com/old-logo.svg'), 'image/svg+xml', { kind: 'image' });
  assert.equal(newcomer.localRel, stalePath, 'path livre não deve gerar colisão falsa');
  assert.doesNotMatch(newcomer.localRel, /__c_/);
});

test('V-03: colisões reais continuam detectadas (sem regressão da proteção)', () => {
  const registry = new AssetRegistry();
  const a = registry.register(new URL('https://example.com/a<b.png'), 'image/png', { kind: 'image' });
  const b = registry.register(new URL('https://example.com/a>b.png'), 'image/png', { kind: 'image' });
  assert.notEqual(a.localRel, b.localRel);
  assert.match(b.localRel, /__c_[a-f0-9]{10}\.png$/);
});

test('V-03: alias duplicado retorna a mesma entrada (idempotente)', () => {
  const registry = new AssetRegistry();
  const finalEntry = registry.register(new URL('https://example.com/x.png'), 'image/png', { kind: 'image' });
  const first = registry.register(new URL('https://example.com/old-x'), 'image/png', { viaRedirect: true, localRel: finalEntry.localRel });
  const again = registry.register(new URL('https://example.com/old-x'), 'image/png', { viaRedirect: true, localRel: finalEntry.localRel });
  assert.equal(first, again);
});
