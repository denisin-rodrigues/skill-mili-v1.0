import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { CdpSession } from '../../browser/cdp-session.js';

let server;
let baseUrl;
let browser;

before(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ntm-cdp-'));
  fs.writeFileSync(path.join(tmp, 'index.html'), '<html><head><link rel="stylesheet" href="/style.css"></head><body>cdp</body></html>');
  fs.writeFileSync(path.join(tmp, 'style.css'), 'body{color:red}');
  fs.writeFileSync(path.join(tmp, 'style.css.map'), '{}');
  server = http.createServer((req, res) => {
    const file = req.url === '/' ? '/index.html' : req.url;
    const abs = path.join(tmp, file);
    if (!fs.existsSync(abs)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'Content-Type': file.endsWith('.css') ? 'text/css' : 'text/html' });
    fs.createReadStream(abs).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  await browser.close();
  server.close();
});

test('CDP: cria sessão, registra Network e encerra corretamente', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const cdp = await CdpSession.attach(page);
  await page.goto(baseUrl, { waitUntil: 'load' });

  const summary = cdp.summary();
  assert.ok(summary.counts.requests >= 2, `esperava ≥2 requests, veio ${summary.counts.requests}`);
  assert.ok(summary.counts.responses >= 2);
  assert.ok(summary.requests.some((r) => r.url === `${baseUrl}/`));
  assert.ok(summary.responses.some((r) => r.url === `${baseUrl}/style.css` && r.status === 200));

  await cdp.collectServiceWorkerTargets();
  assert.equal(Array.isArray(cdp.serviceWorkers), true);

  await cdp.close();
  await assert.rejects(() => cdp.send('Network.enable'), /encerrada/);
  await cdp.close(); // idempotente
  await context.close();
});

test('CDP: registra failures de rede', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const cdp = await CdpSession.attach(page);
  await page.route('**/blocked.png', (route) => route.abort());
  await page.setContent('<img src="/blocked.png">').catch(() => {});
  await page.goto(`${baseUrl}/`, { waitUntil: 'load' });
  await page.evaluate(() => {
    const img = document.createElement('img');
    img.src = '/blocked.png';
    document.body.appendChild(img);
  });
  await page.waitForTimeout(500);
  assert.ok(cdp.failures.length >= 1, 'falha de rede registrada via CDP');
  await cdp.close();
  await context.close();
});

test('CDP: guarda — rejeita navegador não-Chromium', async () => {
  const fakePage = /** @type {any} */ ({
    context: () => ({
      browser: () => ({ browserType: () => ({ name: () => 'firefox' }) }),
    }),
  });
  await assert.rejects(() => CdpSession.attach(fakePage), /limitado ao Chromium/);
});

test('CDP: headers sensíveis mascarados nos registros', async () => {
  const context = await browser.newContext({ extraHTTPHeaders: { cookie: 'session=SECRET123' } });
  const page = await context.newPage();
  const cdp = await CdpSession.attach(page);
  await page.goto(baseUrl, { waitUntil: 'load' });
  const dump = JSON.stringify(cdp.summary());
  assert.equal(dump.includes('SECRET123'), false, 'cookie jamais aparece nos registros CDP');
  assert.ok(dump.includes('[REDACTED]') || !dump.includes('session='), 'header sensível mascarado');
  await cdp.close();
  await context.close();
});
