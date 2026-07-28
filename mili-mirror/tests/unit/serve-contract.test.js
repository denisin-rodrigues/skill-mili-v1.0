import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createMirrorServer } from '../../server/serve.js';

let server;
let baseUrl;
let tmp;

before(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ntm-serve-'));
  fs.mkdirSync(path.join(tmp, 'mirror', 'pages'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'mirror', 'assets', 'example.com', 'img'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'mirror', 'pages', 'index.html'), '<h1>home</h1>');
  fs.writeFileSync(path.join(tmp, 'mirror', 'assets', 'example.com', 'img', 'a__q_aaaa.png'), 'VARIANT-640');
  fs.writeFileSync(path.join(tmp, 'mirror', 'assets', 'example.com', 'img', 'a__q_bbbb.png'), 'VARIANT-1280');
  fs.writeFileSync(path.join(tmp, 'mirror', 'assets', 'example.com', 'img', 'plain.png'), 'PLAIN');
  fs.writeFileSync(path.join(tmp, 'mirror', 'assets', 'example.com', 'img', 'mixed.png'), 'MIXED-PLAIN');
  fs.writeFileSync(path.join(tmp, 'mirror', 'assets', 'example.com', 'img', 'mixed__q_cccc.png'), 'MIXED-VARIANT');
  fs.writeFileSync(path.join(tmp, 'mirror', 'assets', 'example.com', 'video.mp4'), '0123456789'.repeat(10));

  const contract = {
    version: 2,
    host: '127.0.0.1',
    port: 0,
    routes: [{ requestPath: '/', file: 'mirror/pages/index.html', contentType: 'text/html' }],
    assets: [
      { requestPath: '/img/a.png', requestQuery: 'w=640', file: 'mirror/assets/example.com/img/a__q_aaaa.png', contentType: 'image/png', kind: 'image' },
      { requestPath: '/img/a.png', requestQuery: 'w=1280', file: 'mirror/assets/example.com/img/a__q_bbbb.png', contentType: 'image/png', kind: 'image' },
      { requestPath: '/img/plain.png', requestQuery: '', file: 'mirror/assets/example.com/img/plain.png', contentType: 'image/png', kind: 'image' },
      // V-04: mesmo path com entrada query-insensitive E variante — ambas devem funcionar
      { requestPath: '/img/mixed.png', requestQuery: '', file: 'mirror/assets/example.com/img/mixed.png', contentType: 'image/png', kind: 'image' },
      { requestPath: '/img/mixed.png', requestQuery: 'v=2', file: 'mirror/assets/example.com/img/mixed__q_cccc.png', contentType: 'image/png', kind: 'image' },
      { requestPath: '/video.mp4', requestQuery: 'v=hd', file: 'mirror/assets/example.com/video.mp4', contentType: 'video/mp4', kind: 'video' },
    ],
    querySensitiveAssets: true,
    byteRangeSupport: true,
    spaFallback: false,
  };
  fs.writeFileSync(path.join(tmp, 'contract.json'), JSON.stringify(contract));
  const started = await createMirrorServer({ contractPath: path.join(tmp, 'contract.json'), root: tmp, port: 0 });
  server = started.server;
  baseUrl = `http://127.0.0.1:${started.address.port}`;
});

after(() => {
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('contrato inválido é rejeitado na inicialização (schema ativo)', async () => {
  const bad = fs.mkdtempSync(path.join(os.tmpdir(), 'ntm-serve-bad-'));
  fs.writeFileSync(path.join(bad, 'contract.json'), JSON.stringify({ version: 1, routes: [] }));
  await assert.rejects(
    async () => {
      createMirrorServer({ contractPath: path.join(bad, 'contract.json'), root: bad, port: 0 });
    },
    /serving-contract|version/i,
  );
  fs.rmSync(bad, { recursive: true, force: true });
});

test('rota declarada responde 200', async () => {
  const res = await fetch(`${baseUrl}/`);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /<h1>home<\/h1>/);
});

test('queries diferentes resolvem arquivos diferentes', async () => {
  const r640 = await fetch(`${baseUrl}/img/a.png?w=640`);
  const r1280 = await fetch(`${baseUrl}/img/a.png?w=1280`);
  assert.equal(await r640.text(), 'VARIANT-640');
  assert.equal(await r1280.text(), 'VARIANT-1280');
});

test('query não declarada em path query-sensitive → 404 real (sem fallback)', async () => {
  const res = await fetch(`${baseUrl}/img/a.png?w=999`);
  assert.equal(res.status, 404);
  const noQuery = await fetch(`${baseUrl}/img/a.png`);
  assert.equal(noQuery.status, 404);
});

test('V-04: path com entrada plain E variante — ambas resolvem corretamente', async () => {
  const plain = await fetch(`${baseUrl}/img/mixed.png`);
  assert.equal(await plain.text(), 'MIXED-PLAIN');
  const withAnyQuery = await fetch(`${baseUrl}/img/mixed.png?outra=1`);
  assert.equal(await withAnyQuery.text(), 'MIXED-PLAIN', 'entrada plain declarada é query-insensitive');
  const variant = await fetch(`${baseUrl}/img/mixed.png?v=2`);
  assert.equal(await variant.text(), 'MIXED-VARIANT', 'variante exata vence quando declarada');
});

test('asset query-insensitive ignora query arbitrária', async () => {
  const res = await fetch(`${baseUrl}/img/plain.png?v=qualquer`);
  assert.equal(res.status, 200);
  assert.equal(await res.text(), 'PLAIN');
});

test('/__assets/ serve arquivo reescrito diretamente', async () => {
  const res = await fetch(`${baseUrl}/__assets/example.com/img/plain.png`);
  assert.equal(res.status, 200);
  assert.equal(await res.text(), 'PLAIN');
});

test('byte-range retorna 206 com fatia correta; vídeo com query', async () => {
  const res = await fetch(`${baseUrl}/video.mp4?v=hd`, { headers: { Range: 'bytes=0-9' } });
  assert.equal(res.status, 206);
  assert.equal(res.headers.get('content-range'), 'bytes 0-9/100');
  assert.equal(await res.text(), '0123456789');
});

test('HEAD e 405 para métodos não suportados', async () => {
  const head = await fetch(`${baseUrl}/img/plain.png`, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('content-length'), '5');
  const post = await fetch(`${baseUrl}/`, { method: 'POST' });
  assert.equal(post.status, 405);
});

// fetch/undici normaliza '..' antes de enviar; http.request envia o path verbatim (wire-raw)
function rawGet(urlPath) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl);
    const req = http.request({ hostname: url.hostname, port: url.port, path: urlPath, method: 'GET' }, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    req.end();
  });
}

test('traversal raw e encoded bloqueados (V-01: inspeção antes de normalizar)', async () => {
  assert.equal(await rawGet('/../../../contract.json'), 403, 'traversal raw deve dar 403, nunca arquivo');
  assert.equal(await rawGet('/..\\..\\contract.json'), 403, 'separador Windows também é traversal');
  assert.equal(await rawGet('/%2e%2e/%2e%2e/contract.json'), 403, 'encoded');
  assert.equal(await rawGet('/%252e%252e%252f%252e%252e%252fcontract.json'), 403, 'double encoded');
  const missing = await fetch(`${baseUrl}/nao-existe.png`);
  assert.equal(missing.status, 404);
});
