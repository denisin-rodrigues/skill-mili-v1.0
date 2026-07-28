import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rewriteCss } from '../../scripts/lib/rewrite/css-rewriter.js';

// CSS file lives at https://example.com/assets/css/style.css — relative URLs resolve against it
const BASE = 'https://example.com/assets/css/style.css';

function makeCtx(captured, report = []) {
  const index = new Map(Object.entries(captured));
  return {
    sourceFile: 'mirror/assets/example.com/assets/css/style.css',
    baseUrl: BASE,
    report,
    lookup: (canonical) => index.get(canonical) || null,
    isAuthorized: (url) => url.hostname === 'example.com',
  };
}

const CAPTURED = {
  'https://example.com/assets/css/imported.css': { localRel: 'mirror/assets/example.com/assets/css/imported.css' },
  'https://example.com/assets/fonts/inter.woff2': { localRel: 'mirror/assets/example.com/assets/fonts/inter.woff2' },
  'https://example.com/assets/img/bg.png': { localRel: 'mirror/assets/example.com/assets/img/bg.png' },
  'https://example.com/assets/img/hero.webp?v=2': { localRel: 'mirror/assets/example.com/assets/img/hero__q_cccccccccc.webp' },
  'https://example.com/assets/css/style.css.map': { localRel: 'mirror/assets/example.com/assets/css/style.css.map' },
};

test('url() com e sem aspas, fontes, imagens, query e paths relativos ao CSS', async () => {
  const report = [];
  const css = `
@font-face { font-family: 'Inter'; src: url('../fonts/inter.woff2') format('woff2'); }
.hero { background: url("../img/bg.png"); }
.card { background: url(../img/hero.webp?v=2); }
.icon { cursor: url("data:image/svg+xml;utf8,<svg/>"), auto; }
`;
  const out = await rewriteCss(css, makeCtx(CAPTURED, report));
  assert.match(out, /url\('?\/__assets\/example.com\/assets\/fonts\/inter.woff2'?\)/);
  assert.match(out, /url\("?\/__assets\/example.com\/assets\/img\/bg.png"?\)/);
  assert.match(out, /url\(\/?__assets\/example.com\/assets\/img\/hero__q_cccccccccc.webp\)/);
  assert.match(out, /data:image\/svg\+xml/);
  assert.equal(report.filter((r) => r.status === 'rewritten').length, 3);
  assert.ok(report.find((r) => r.reason === 'non-fetchable:data'));
});

test('@import nas formas string e url()', async () => {
  const report = [];
  const cssA = '@import "./imported.css";\nbody { color: red; }';
  const outA = await rewriteCss(cssA, makeCtx(CAPTURED, report));
  assert.match(outA, /@import "\/__assets\/example.com\/assets\/css\/imported.css"/);

  const cssB = '@import url(./imported.css) screen;\nbody { color: red; }';
  const outB = await rewriteCss(cssB, makeCtx(CAPTURED, report));
  assert.match(outB, /@import url\(\/__assets\/example.com\/assets\/css\/imported.css\) screen/);
});

test('sourceMappingURL é reescrito quando o map foi capturado', async () => {
  const report = [];
  const css = 'body { margin: 0; }\n/*# sourceMappingURL=style.css.map */';
  const out = await rewriteCss(css, makeCtx(CAPTURED, report));
  assert.match(out, /sourceMappingURL=\/__assets\/example.com\/assets\/css\/style.css.map/);
  assert.ok(report.find((r) => r.referenceType === 'css:source-map' && r.status === 'rewritten'));
});

test('sourceMappingURL não capturado fica intacto com motivo registrado', async () => {
  const report = [];
  const css = 'body { margin: 0; }\n/*# sourceMappingURL=outro.css.map */';
  const out = await rewriteCss(css, makeCtx(CAPTURED, report));
  assert.match(out, /sourceMappingURL=outro.css.map/);
  const entry = report.find((r) => r.referenceType === 'css:source-map');
  assert.equal(entry.status, 'skipped');
  assert.equal(entry.reason, 'not-captured');
});

test('url externa não autorizada não é alterada', async () => {
  const report = [];
  const css = '.x { background: url("https://cdn.evil.com/x.png"); }';
  const out = await rewriteCss(css, makeCtx(CAPTURED, report));
  assert.match(out, /https:\/\/cdn.evil.com\/x.png/);
  assert.equal(report[0].reason, 'external-not-authorized');
});
