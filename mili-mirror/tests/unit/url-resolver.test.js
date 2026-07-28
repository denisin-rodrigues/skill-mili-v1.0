import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyUrl, resolveUrl, canonicalizeUrl, fragmentOf, canonicalQuery, isNonFetchable } from '../../scripts/lib/url-resolver.js';

const BASE = 'https://example.com/produto/detalhe';

test('classifica todos os tipos de URL', () => {
  assert.equal(classifyUrl('https://cdn.example.com/a.png'), 'absolute-http');
  assert.equal(classifyUrl('http://example.com/a.png'), 'absolute-http');
  assert.equal(classifyUrl('//cdn.example.com/a.png'), 'protocol-relative');
  assert.equal(classifyUrl('/assets/a.png'), 'root-relative');
  assert.equal(classifyUrl('./a.png'), 'relative');
  assert.equal(classifyUrl('a.png'), 'relative');
  assert.equal(classifyUrl('../a.png'), 'relative');
  assert.equal(classifyUrl('#secao'), 'fragment-only');
  assert.equal(classifyUrl('data:image/png;base64,AAAA'), 'data');
  assert.equal(classifyUrl('blob:https://example.com/uuid'), 'blob');
  assert.equal(classifyUrl('mailto:a@b.com'), 'mailto');
  assert.equal(classifyUrl('tel:+550000000'), 'tel');
  assert.equal(classifyUrl('javascript:void(0)'), 'javascript');
  assert.equal(classifyUrl('ftp://x.com/a'), 'other-scheme');
  assert.equal(classifyUrl(''), 'empty');
});

test('resolve URLs relativas em rota aninhada', () => {
  assert.equal(resolveUrl('./a.png', BASE)?.toString(), 'https://example.com/produto/a.png');
  assert.equal(resolveUrl('../img/a.png', BASE)?.toString(), 'https://example.com/img/a.png');
  assert.equal(resolveUrl('../../a.png', BASE)?.toString(), 'https://example.com/a.png');
  assert.equal(resolveUrl('/abs/a.png', BASE)?.toString(), 'https://example.com/abs/a.png');
  assert.equal(resolveUrl('//cdn.x.com/a.png', BASE)?.toString(), 'https://cdn.x.com/a.png');
  assert.equal(resolveUrl('sub/a.png', 'https://example.com/dir/page.html')?.toString(), 'https://example.com/dir/sub/a.png');
});

test('não resolve URLs não-capturáveis', () => {
  assert.equal(resolveUrl('data:image/png;base64,AA', BASE), null);
  assert.equal(resolveUrl('mailto:a@b.com', BASE), null);
  assert.equal(resolveUrl('#topo', BASE), null);
  assert.equal(resolveUrl('javascript:alert(1)', BASE), null);
  assert.equal(isNonFetchable('tel:123'), true);
});

test('canonicalização remove fragment e preserva query', () => {
  assert.equal(canonicalizeUrl('https://example.com/a.png?v=2#frag'), 'https://example.com/a.png?v=2');
  assert.equal(canonicalizeUrl('https://EXAMPLE.com/a.png'), 'https://example.com/a.png');
  assert.equal(canonicalizeUrl('https://example.com:443/a.png'), 'https://example.com/a.png');
  assert.notEqual(canonicalizeUrl('https://example.com/a.png?w=640'), canonicalizeUrl('https://example.com/a.png?w=1280'));
});

test('fragment e query helpers', () => {
  assert.equal(fragmentOf('/a.svg#icon'), 'icon');
  assert.equal(fragmentOf('/a.svg'), null);
  assert.equal(canonicalQuery(new URL('https://x.com/a?w=1&h=2')), 'w=1&h=2');
  assert.equal(canonicalQuery(new URL('https://x.com/a')), '');
});
