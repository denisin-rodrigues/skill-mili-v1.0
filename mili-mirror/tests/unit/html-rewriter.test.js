import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rewriteHtml, parseSrcset } from '../../scripts/lib/rewrite/html-rewriter.js';

const BASE = 'https://example.com/produto/detalhe';

function makeCtx(captured, { routes = ['/sobre'], report = [] } = {}) {
  const index = new Map(Object.entries(captured));
  return {
    sourceFile: 'mirror/pages/produto_detalhe.html',
    baseUrl: BASE,
    report,
    forms: /** @type {'disabled'|'preserve'} */ ('disabled'),
    lookup: (canonical) => index.get(canonical) || null,
    routeFor: (url) => (url.hostname === 'example.com' && routes.includes(url.pathname) ? url.pathname : null),
    isAuthorized: (url) => url.hostname === 'example.com',
  };
}

const CAPTURED = {
  'https://example.com/assets/logo.svg': { localRel: 'mirror/assets/example.com/assets/logo.svg' },
  'https://example.com/img/responsive.png?w=640': { localRel: 'mirror/assets/example.com/img/responsive__q_aaaaaaaaaa.png' },
  'https://example.com/img/responsive.png?w=1280': { localRel: 'mirror/assets/example.com/img/responsive__q_bbbbbbbbbb.png' },
  'https://example.com/video/intro.mp4': { localRel: 'mirror/assets/example.com/video/intro.mp4' },
  'https://example.com/img/poster.png': { localRel: 'mirror/assets/example.com/img/poster.png' },
  'https://example.com/app/main.js': { localRel: 'mirror/assets/example.com/app/main.js' },
  'https://example.com/css/style.css': { localRel: 'mirror/assets/example.com/css/style.css' },
  'https://example.com/icons.svg': { localRel: 'mirror/assets/example.com/icons.svg' },
  'https://example.com/site.webmanifest': { localRel: 'mirror/assets/example.com/site.webmanifest' },
  'https://example.com/docs/spec.svg': { localRel: 'mirror/assets/example.com/docs/spec.svg' },
};

test('srcset: parser separa candidatos e preserva vírgulas internas', () => {
  const candidates = parseSrcset('/a.png 1x, /b.png 2x');
  assert.deepEqual(candidates.map((c) => c.url), ['/a.png', '/b.png']);
  const withCommas = parseSrcset('/img.png?fit=1,2 1x');
  assert.equal(withCommas[0].url, '/img.png?fit=1,2');
  assert.equal(withCommas[0].descriptor, '1x');
});

test('reescrita cobre src, srcset, imagesrcset, poster, source e fragment', () => {
  const report = [];
  const html = `<!DOCTYPE html><html><body>
    <img src="/assets/logo.svg">
    <img srcset="/img/responsive.png?w=640 640w, /img/responsive.png?w=1280 1280w" sizes="100vw">
    <link rel="preload" as="image" imagesrcset="/img/responsive.png?w=640 640w">
    <video poster="/img/poster.png"><source src="/video/intro.mp4" type="video/mp4"></video>
    <img src="/icons.svg#icon-star">
  </body></html>`;
  const out = rewriteHtml(html, makeCtx(CAPTURED, { report }));
  assert.match(out, /src="\/__assets\/example.com\/assets\/logo.svg"/);
  assert.match(out, /\/__assets\/example.com\/img\/responsive__q_aaaaaaaaaa.png 640w/);
  assert.match(out, /\/__assets\/example.com\/img\/responsive__q_bbbbbbbbbb.png 1280w/);
  assert.match(out, /imagesrcset="\/__assets\/example.com\/img\/responsive__q_aaaaaaaaaa.png 640w"/);
  assert.match(out, /poster="\/__assets\/example.com\/img\/poster.png"/);
  assert.match(out, /src="\/__assets\/example.com\/video\/intro.mp4"/);
  assert.match(out, /\/__assets\/example.com\/icons.svg#icon-star/);
  assert.equal(report.filter((r) => r.status === 'rewritten').length, 7);
});

test('script, stylesheet, modulepreload, manifest, object, embed, iframe', () => {
  const report = [];
  const html = `<!DOCTYPE html><html><head>
    <script src="/app/main.js"></script>
    <link rel="stylesheet" href="/css/style.css">
    <link rel="modulepreload" href="/app/main.js">
    <link rel="manifest" href="/site.webmanifest">
  </head><body>
    <object data="/docs/spec.svg" type="image/svg+xml"></object>
    <embed src="/docs/spec.svg" type="image/svg+xml">
    <iframe src="/sobre" title="ok"></iframe>
  </body></html>`;
  const out = rewriteHtml(html, makeCtx(CAPTURED, { report }));
  assert.equal((out.match(/\/__assets\/example.com\/app\/main.js/g) || []).length, 2);
  assert.match(out, /href="\/__assets\/example.com\/css\/style.css"/);
  assert.match(out, /href="\/__assets\/example.com\/site.webmanifest"/);
  assert.equal((out.match(/\/__assets\/example.com\/docs\/spec.svg/g) || []).length, 2);
  // iframe para rota autorizada: localizada para a rota local
  assert.match(out, /iframe src="\/sobre"/);
  assert.ok(report.find((r) => r.referenceType === 'html:iframe@src' && r.reason === 'route-localized'));
});

test('form action é neutralizado com evidência, sem submissão perigosa', () => {
  const report = [];
  const html = '<!DOCTYPE html><html><body><form action="/pesquisar" method="get"><input name="q"></form></body></html>';
  const out = rewriteHtml(html, makeCtx(CAPTURED, { report }));
  assert.match(out, /action="#"/);
  assert.match(out, /data-original-action="\/pesquisar"/);
  const entry = report.find((r) => r.referenceType === 'html:form@action');
  assert.equal(entry.status, 'rewritten');
  assert.equal(entry.reason, 'form-neutralized');
});

test('URLs não-capturáveis nunca são alteradas', () => {
  const report = [];
  const html = `<!DOCTYPE html><html><body>
    <a href="mailto:a@b.com">mail</a>
    <a href="tel:+5511">tel</a>
    <a href="javascript:void(0)">js</a>
    <a href="#ancora">anchor</a>
    <img src="data:image/png;base64,AAAA">
  </body></html>`;
  const out = rewriteHtml(html, makeCtx(CAPTURED, { report }));
  assert.match(out, /mailto:a@b.com/);
  assert.match(out, /tel:\+5511/);
  assert.match(out, /javascript:void\(0\)/);
  assert.match(out, /href="#ancora"/);
  assert.match(out, /data:image\/png;base64,AAAA/);
  assert.ok(report.every((r) => r.status !== 'rewritten'));
});

test('externo bloqueado e não-capturado são registrados com motivo', () => {
  const report = [];
  const html = `<!DOCTYPE html><html><body>
    <img src="https://cdn.evil.com/x.png">
    <img src="/nao-capturado.png">
  </body></html>`;
  rewriteHtml(html, makeCtx(CAPTURED, { report }));
  const blocked = report.find((r) => r.originalValue === 'https://cdn.evil.com/x.png');
  assert.equal(blocked.status, 'skipped');
  assert.equal(blocked.reason, 'external-not-authorized');
  const missing = report.find((r) => r.originalValue === '/nao-capturado.png');
  assert.equal(missing.status, 'skipped');
  assert.equal(missing.reason, 'not-captured');
});

test('style inline com url() e <base href> preservado', () => {
  const report = [];
  const html = `<!DOCTYPE html><html><head><base href="https://example.com/"></head>
  <body><div style="background: url('/assets/logo.svg')"></div></body></html>`;
  const out = rewriteHtml(html, makeCtx(CAPTURED, { report }));
  assert.match(out, /url\('\/__assets\/example.com\/assets\/logo.svg'\)/);
  assert.match(out, /<base href="https:\/\/example.com\/">/);
  assert.ok(report.find((r) => r.referenceType === 'html:base@href' && r.reason === 'base-tag-preserved'));
});
