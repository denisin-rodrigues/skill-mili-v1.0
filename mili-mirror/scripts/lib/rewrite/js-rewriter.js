// Controlled JavaScript rewriting with a real parser (acorn AST).
// Conservative: only clearly identifiable static references are touched —
//   import '...' | export ... from '...' | import('...') | new URL('...', import.meta.url)
//   new Worker('...') | new SharedWorker('...') | fetch('...')
// Arbitrary strings, dynamically built URLs and unparseable code are NEVER modified.
// Every candidate position (rewritten or not) is recorded as evidence.
import * as acorn from 'acorn';
import { classifyUrl, resolveUrl, canonicalizeUrl, fragmentOf } from '../url-resolver.js';
import { localUrlFor } from '../asset-store.js';

function report(ctx, entry) {
  ctx.report.push({ strategy: 'acorn', ...entry });
}

function resolveReference(raw, referenceType, ctx, confidence) {
  const kind = classifyUrl(raw);
  if (kind === 'empty') return null;
  if (['data', 'blob', 'mailto', 'tel', 'javascript', 'other-scheme', 'fragment-only'].includes(kind)) {
    if (kind !== 'fragment-only') {
      report(ctx, { sourceFile: ctx.sourceFile, originalUrl: null, originalValue: raw, rewrittenValue: null, referenceType, status: 'skipped', reason: `non-fetchable:${kind}`, confidence });
    }
    return null;
  }

  // Document-relative forms (fetch, Worker) resolve against the PAGE base at runtime,
  // not the JS file URL. Try the JS file base first, then the document base fallback.
  const documentRelative = ['js:fetch', 'js:worker', 'js:sharedworker'].includes(referenceType);
  const bases = [ctx.baseUrl];
  if (documentRelative && ctx.documentBaseUrl && ctx.documentBaseUrl !== ctx.baseUrl) {
    bases.push(ctx.documentBaseUrl);
  }

  let absolute = null;
  let entry = null;
  let usedFallback = false;
  for (const base of bases) {
    absolute = resolveUrl(raw, base);
    if (!absolute) continue;
    entry = ctx.lookup(canonicalizeUrl(absolute));
    if (entry) {
      usedFallback = base !== ctx.baseUrl;
      break;
    }
  }
  if (!absolute) {
    report(ctx, { sourceFile: ctx.sourceFile, originalUrl: null, originalValue: raw, rewrittenValue: null, referenceType, status: 'skipped', reason: 'unresolvable', confidence });
    return null;
  }
  const fragment = fragmentOf(raw);
  if (entry) {
    const value = localUrlFor(entry, fragment);
    report(ctx, {
      sourceFile: ctx.sourceFile,
      originalUrl: absolute.toString(),
      originalValue: raw,
      rewrittenValue: value,
      referenceType,
      status: 'rewritten',
      reason: entry.viaRedirect ? 'captured-via-redirect' : usedFallback ? 'captured-via-document-base' : 'captured',
      confidence: usedFallback ? 'medium' : confidence,
    });
    return value;
  }
  const authorized = ctx.isAuthorized(absolute);
  report(ctx, {
    sourceFile: ctx.sourceFile,
    originalUrl: absolute.toString(),
    originalValue: raw,
    rewrittenValue: null,
    referenceType,
    status: 'skipped',
    reason: authorized ? 'not-captured' : 'external-not-authorized',
    confidence,
  });
  return null;
}

function isImportMetaUrl(node) {
  return (
    node &&
    node.type === 'MemberExpression' &&
    node.object &&
    node.object.type === 'MetaProperty' &&
    node.object.meta.name === 'import' &&
    node.object.property.name === 'meta' &&
    node.property &&
    ((node.property.type === 'Identifier' && node.property.name === 'url') ||
      (node.property.type === 'Literal' && node.property.value === 'url'))
  );
}

/** Generic AST walker (acorn produces plain objects without parent refs). */
function walk(node, visit) {
  if (!node || typeof node.type !== 'string') return;
  visit(node);
  for (const key of Object.keys(node)) {
    if (key === 'type' || key === 'start' || key === 'end' || key === 'loc' || key === 'range') continue;
    const value = node[key];
    if (Array.isArray(value)) {
      for (const child of value) if (child && typeof child.type === 'string') walk(child, visit);
    } else if (value && typeof value.type === 'string') {
      walk(value, visit);
    }
  }
}

/**
 * Rewrites a JavaScript file conservatively.
 * @param {string} code
 * @param {import('./html-rewriter.js').RewriteContext} ctx
 * @returns {string}
 */
export function rewriteJs(code, ctx) {
  let ast;
  try {
    ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module' });
  } catch {
    try {
      ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'script', allowImportExportEverywhere: false });
    } catch (err) {
      report(ctx, {
        sourceFile: ctx.sourceFile,
        originalUrl: null,
        originalValue: null,
        rewrittenValue: null,
        referenceType: 'js:parse',
        status: 'failed',
        reason: `parse-error: ${err.message}`,
        confidence: 'high',
      });
      return code; // untouched
    }
  }

  /** @type {Array<{start:number, end:number, value:string}>} */
  const edits = [];

  const considerLiteral = (literalNode, referenceType, confidence) => {
    if (!literalNode || literalNode.type !== 'Literal' || typeof literalNode.value !== 'string') {
      return;
    }
    const raw = literalNode.value;
    const resolved = resolveReference(raw, referenceType, ctx, confidence);
    if (resolved) {
      edits.push({ start: literalNode.start, end: literalNode.end, value: JSON.stringify(resolved) });
    }
  };

  const noteDynamic = (node, referenceType) => {
    report(ctx, {
      sourceFile: ctx.sourceFile,
      originalUrl: null,
      originalValue: code.slice(node.start, node.end).slice(0, 120),
      rewrittenValue: null,
      referenceType,
      status: 'skipped',
      reason: 'dynamic-expression',
      confidence: 'high',
    });
  };

  walk(ast, (node) => {
    switch (node.type) {
      case 'ImportDeclaration':
        considerLiteral(node.source, 'js:import', 'high');
        break;
      case 'ExportAllDeclaration':
      case 'ExportNamedDeclaration':
        if (node.source) considerLiteral(node.source, 'js:export-from', 'high');
        break;
      case 'ImportExpression':
        if (node.source && node.source.type === 'Literal' && typeof node.source.value === 'string') {
          considerLiteral(node.source, 'js:dynamic-import', 'high');
        } else if (node.source) {
          noteDynamic(node.source, 'js:dynamic-import');
        }
        break;
      case 'NewExpression': {
        const calleeName = node.callee && node.callee.type === 'Identifier' ? node.callee.name : null;
        if (calleeName === 'Worker' || calleeName === 'SharedWorker') {
          const first = node.arguments?.[0];
          if (first && first.type === 'Literal') considerLiteral(first, `js:${calleeName.toLowerCase()}`, 'high');
          else if (first) noteDynamic(first, `js:${calleeName.toLowerCase()}`);
        } else if (calleeName === 'URL') {
          const [first, second] = node.arguments || [];
          if (first && first.type === 'Literal' && second && isImportMetaUrl(second)) {
            considerLiteral(first, 'js:new-url-import-meta', 'high');
          }
        }
        break;
      }
      case 'CallExpression': {
        if (node.callee && node.callee.type === 'Identifier' && node.callee.name === 'fetch') {
          const first = node.arguments?.[0];
          if (first && first.type === 'Literal' && typeof first.value === 'string') {
            considerLiteral(first, 'js:fetch', 'high');
          } else if (first) {
            noteDynamic(first, 'js:fetch');
          }
        }
        break;
      }
      default:
        break;
    }
  });

  if (edits.length === 0) return code;
  // Apply edits from the end backwards so positions stay valid
  let out = code;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    out = out.slice(0, edit.start) + edit.value + out.slice(edit.end);
  }
  return out;
}
