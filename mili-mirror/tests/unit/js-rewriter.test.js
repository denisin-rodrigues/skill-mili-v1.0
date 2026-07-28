import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rewriteJs } from '../../scripts/lib/rewrite/js-rewriter.js';

// JS module lives at https://example.com/assets/app/main.js
const BASE = 'https://example.com/assets/app/main.js';

function makeCtx(captured, report = []) {
  const index = new Map(Object.entries(captured));
  return {
    sourceFile: 'mirror/assets/example.com/assets/app/main.js',
    baseUrl: BASE,
    report,
    lookup: (canonical) => index.get(canonical) || null,
    isAuthorized: (url) => url.hostname === 'example.com',
  };
}

const CAPTURED = {
  'https://example.com/assets/app/util.js': { localRel: 'mirror/assets/example.com/assets/app/util.js' },
  'https://example.com/assets/app/lazy-chunk.js': { localRel: 'mirror/assets/example.com/assets/app/lazy-chunk.js' },
  'https://example.com/assets/app/worker.js': { localRel: 'mirror/assets/example.com/assets/app/worker.js' },
  'https://example.com/assets/app/shared.js': { localRel: 'mirror/assets/example.com/assets/app/shared.js' },
  'https://example.com/assets/img/icon.svg': { localRel: 'mirror/assets/example.com/assets/img/icon.svg' },
  'https://example.com/api-data.json': { localRel: 'mirror/assets/example.com/api-data.json' },
};

test('import estático e export from', () => {
  const report = [];
  const code = `import { x } from './util.js';\nexport { y } from './util.js';\nexport * from './util.js';`;
  const out = rewriteJs(code, makeCtx(CAPTURED, report));
  const count = (out.match(/\/__assets\/example.com\/assets\/app\/util.js/g) || []).length;
  assert.equal(count, 3);
  assert.equal(report.filter((r) => r.status === 'rewritten').length, 3);
  assert.deepEqual(report.map((r) => r.referenceType), ['js:import', 'js:export-from', 'js:export-from']);
});

test('dynamic import com string literal', () => {
  const report = [];
  const code = `button.onclick = () => import('./lazy-chunk.js').then(m => m.run());`;
  const out = rewriteJs(code, makeCtx(CAPTURED, report));
  assert.match(out, /import\("\/__assets\/example.com\/assets\/app\/lazy-chunk.js"\)/);
  assert.equal(report[0].referenceType, 'js:dynamic-import');
  assert.equal(report[0].status, 'rewritten');
});

test('Worker e SharedWorker com string literal', () => {
  const report = [];
  const code = `const w = new Worker('./worker.js');\nconst s = new SharedWorker('./shared.js');`;
  const out = rewriteJs(code, makeCtx(CAPTURED, report));
  assert.match(out, /new Worker\("\/__assets\/example.com\/assets\/app\/worker.js"\)/);
  assert.match(out, /new SharedWorker\("\/__assets\/example.com\/assets\/app\/shared.js"\)/);
  assert.deepEqual(report.map((r) => r.referenceType), ['js:worker', 'js:sharedworker']);
});

test('new URL(literal, import.meta.url)', () => {
  const report = [];
  const code = `const icon = new URL('../img/icon.svg', import.meta.url);`;
  const out = rewriteJs(code, makeCtx(CAPTURED, report));
  assert.match(out, /new URL\("\/__assets\/example.com\/assets\/img\/icon.svg", import.meta.url\)/);
  assert.equal(report[0].referenceType, 'js:new-url-import-meta');
});

test('fetch com string literal conhecida', () => {
  const report = [];
  const code = `const data = await fetch('/api-data.json').then(r => r.json());`;
  const out = rewriteJs(code, makeCtx(CAPTURED, report));
  assert.match(out, /fetch\("\/__assets\/example.com\/api-data.json"\)/);
  assert.equal(report[0].referenceType, 'js:fetch');
});

test('NÃO modifica strings arbitrárias nem URLs dinâmicas', () => {
  const report = [];
  const code = `
const label = './util.js';
const dyn = import('./chunks/' + name + '.js');
const w = new Worker(workerPath);
const f = fetch(base + '/api');
const tpl = \`./\${name}.js\`;
`;
  const out = rewriteJs(code, makeCtx(CAPTURED, report));
  assert.equal(out, code); // byte-identical
  assert.ok(report.every((r) => r.status !== 'rewritten'));
  assert.ok(report.find((r) => r.referenceType === 'js:dynamic-import' && r.reason === 'dynamic-expression'));
  assert.ok(report.find((r) => r.referenceType === 'js:worker' && r.reason === 'dynamic-expression'));
  assert.ok(report.find((r) => r.referenceType === 'js:fetch' && r.reason === 'dynamic-expression'));
});

test('literal não capturado: registrado, não alterado', () => {
  const report = [];
  const code = `import x from './nao-existe.js';`;
  const out = rewriteJs(code, makeCtx(CAPTURED, report));
  assert.equal(out, code);
  assert.equal(report[0].status, 'skipped');
  assert.equal(report[0].reason, 'not-captured');
});

test('falha de parse: arquivo preservado e evidência registrada', () => {
  const report = [];
  const code = `const = quebrado {{{`;
  const out = rewriteJs(code, makeCtx(CAPTURED, report));
  assert.equal(out, code);
  const entry = report.find((r) => r.referenceType === 'js:parse');
  assert.equal(entry.status, 'failed');
  assert.match(entry.reason, /parse-error/);
});

test('código clássico (script) sem módulos também é processado', () => {
  const report = [];
  const code = `var w = new Worker('./worker.js');`;
  const out = rewriteJs(code, makeCtx(CAPTURED, report));
  assert.match(out, /\/__assets\//);
});
