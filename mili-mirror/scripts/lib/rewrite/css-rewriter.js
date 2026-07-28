// CSS rewriting with a real parser (postcss + postcss-value-parser).
// Covers url(...) (quoted/unquoted), @import (string and url() forms), fonts,
// images, sourceMappingURL comments, and paths relative to the CSS file itself.
import postcss from 'postcss';
import valueParser from 'postcss-value-parser';
import { classifyUrl, resolveUrl, canonicalizeUrl, fragmentOf } from '../url-resolver.js';
import { localUrlFor } from '../asset-store.js';

function report(ctx, entry) {
  ctx.report.push({ strategy: 'postcss', confidence: 'high', ...entry });
}

function resolveReference(raw, referenceType, ctx) {
  const kind = classifyUrl(raw);
  if (kind === 'empty') return null;
  if (['data', 'blob', 'mailto', 'tel', 'javascript', 'other-scheme', 'fragment-only'].includes(kind)) {
    if (kind !== 'fragment-only') {
      report(ctx, { sourceFile: ctx.sourceFile, originalUrl: null, originalValue: raw, rewrittenValue: null, referenceType, status: 'skipped', reason: `non-fetchable:${kind}` });
    }
    return null;
  }
  // Base is the CSS file's own original URL: relative paths resolve relative to it
  const absolute = resolveUrl(raw, ctx.baseUrl);
  if (!absolute) {
    report(ctx, { sourceFile: ctx.sourceFile, originalUrl: null, originalValue: raw, rewrittenValue: null, referenceType, status: 'skipped', reason: 'unresolvable' });
    return null;
  }
  const canonical = canonicalizeUrl(absolute);
  const fragment = fragmentOf(raw);
  const entry = ctx.lookup(canonical);
  if (entry) {
    const value = localUrlFor(entry, fragment);
    report(ctx, { sourceFile: ctx.sourceFile, originalUrl: absolute.toString(), originalValue: raw, rewrittenValue: value, referenceType, status: 'rewritten', reason: entry.viaRedirect ? 'captured-via-redirect' : 'captured' });
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
  });
  return null;
}

/** Rebuilds a url(...) function node with a new value, preserving quote style. */
function setUrlNode(funcNode, newValue) {
  const inner = funcNode.nodes[0];
  if (inner.quote) {
    inner.value = newValue;
  } else {
    inner.value = newValue;
  }
}

function rewriteValue(value, referenceType, ctx) {
  if (!/url\s*\(/i.test(value)) return value;
  const parsed = valueParser(value);
  parsed.walk((node) => {
    if (node.type !== 'function' || node.value.toLowerCase() !== 'url' || node.nodes.length === 0) return;
    const raw = node.nodes[0].value;
    const resolved = resolveReference(raw, referenceType, ctx);
    if (resolved) setUrlNode(node, resolved);
  });
  return parsed.toString();
}

/**
 * Rewrites a CSS stylesheet.
 * @param {string} css
 * @param {import('./html-rewriter.js').RewriteContext} ctx
 * @returns {Promise<string>}
 */
export async function rewriteCss(css, ctx) {
  const root = postcss.parse(css, { from: ctx.sourceFile });

  // @import "..." | @import url("...")
  root.walkAtRules('import', (atRule) => {
    const params = atRule.params.trim();
    const parsed = valueParser(params);
    let handled = false;
    parsed.walk((node) => {
      if (handled) return;
      if (node.type === 'function' && node.value.toLowerCase() === 'url' && node.nodes.length > 0) {
        const resolved = resolveReference(node.nodes[0].value, 'css:@import', ctx);
        if (resolved) {
          setUrlNode(node, resolved);
          atRule.params = parsed.toString();
        }
        handled = true;
      } else if (node.type === 'string') {
        const resolved = resolveReference(node.value, 'css:@import', ctx);
        if (resolved) {
          node.value = resolved;
          atRule.params = parsed.toString();
        }
        handled = true;
      }
    });
  });

  // Declarations with url(): fonts, images, backgrounds, cursors, masks, etc.
  root.walkDecls((decl) => {
    if (!/url\s*\(/i.test(decl.value)) return;
    decl.value = rewriteValue(decl.value, `css:url(${decl.prop})`, ctx);
  });

  // /*# sourceMappingURL=... */
  root.walkComments((comment) => {
    const text = comment.text.trim();
    if (!text.startsWith('# sourceMappingURL=')) return;
    const raw = text.slice('# sourceMappingURL='.length).trim();
    const resolved = resolveReference(raw, 'css:source-map', ctx);
    if (resolved) comment.text = ` # sourceMappingURL=${resolved}`;
  });

  return root.toString();
}
