// HTML rewriting with a real parser (parse5) — never regex-only.
// Covers: src, href, srcset, imagesrcset, poster, action (neutralized), preload,
// modulepreload, stylesheet, script, authorized iframe, source, video, audio,
// object, embed, manifest, and inline style="...url(...)". Other attributes and
// non-fetchable URLs (data:, blob:, mailto:, tel:, javascript:, fragments) stay untouched.
import * as parse5 from 'parse5';
import valueParser from 'postcss-value-parser';
import { classifyUrl, resolveUrl, canonicalizeUrl, fragmentOf } from '../url-resolver.js';
import { localUrlFor } from '../asset-store.js';

/** Elements/attributes whose value is a single URL. */
const URL_ATTRS = {
  img: ['src'],
  script: ['src'],
  iframe: ['src'],
  source: ['src'],
  video: ['src', 'poster'],
  audio: ['src'],
  track: ['src'],
  embed: ['src'],
  input: ['src'],
  object: ['data'],
  a: ['href'],
  area: ['href'],
  link: ['href'],
};
const SRCSET_ATTRS = new Set(['srcset', 'imagesrcset']);

/**
 * Parses a srcset value into candidates, preserving descriptors.
 * Handles commas inside URLs correctly per spec (URL ends at whitespace; a comma
 * directly after the URL without descriptors also separates candidates).
 * @param {string} value
 * @returns {Array<{url:string, descriptor:string, raw:string}>}
 */
export function parseSrcset(value) {
  const candidates = [];
  let rest = String(value);
  while (rest.length > 0) {
    rest = rest.replace(/^[\s,]+/, '');
    if (rest === '') break;
    // URL: chars until whitespace (commas followed by non-space are part of the URL)
    let i = 0;
    while (i < rest.length && !/[\s]/.test(rest[i])) i += 1;
    let url = rest.slice(0, i);
    let descriptor = '';
    const trailing = url.match(/,+$/);
    if (trailing) {
      // Trailing commas in the token are candidate separators, not part of the URL
      url = url.slice(0, -trailing[0].length);
      rest = rest.slice(i);
    } else {
      let j = i;
      while (j < rest.length && rest[j] !== ',') j += 1;
      descriptor = rest.slice(i, j).trim();
      rest = rest.slice(j);
    }
    if (url) candidates.push({ url, descriptor, raw: `${url}${descriptor ? ` ${descriptor}` : ''}` });
  }
  return candidates;
}

function report(ctx, entry) {
  ctx.report.push({ strategy: 'parse5', confidence: 'high', ...entry });
}

/**
 * Resolves one raw reference to its new value, recording the outcome.
 * @returns {{value:string|null}} new value, or null when it must stay untouched
 */
function resolveReference(raw, referenceType, ctx) {
  const kind = classifyUrl(raw);
  if (kind === 'empty') return null;
  if (['data', 'blob', 'mailto', 'tel', 'javascript', 'other-scheme'].includes(kind)) {
    report(ctx, { sourceFile: ctx.sourceFile, originalUrl: null, originalValue: raw, rewrittenValue: null, referenceType, status: 'skipped', reason: `non-fetchable:${kind}` });
    return null;
  }
  if (kind === 'fragment-only') return null; // same-document anchor, untouched silently

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
    return { value };
  }

  const routePath = ctx.routeFor ? ctx.routeFor(absolute) : null;
  if (routePath !== null) {
    const value = `${routePath}${absolute.search}${fragment ? `#${fragment}` : ''}`;
    report(ctx, { sourceFile: ctx.sourceFile, originalUrl: absolute.toString(), originalValue: raw, rewrittenValue: value, referenceType, status: 'rewritten', reason: 'route-localized' });
    return { value };
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

/** Rewrites url() inside an inline style attribute, reusing the value parser. */
function rewriteInlineStyle(styleValue, ctx) {
  const parsed = valueParser(styleValue);
  let changed = false;
  parsed.walk((n) => {
    if (n.type !== 'function' || n.value.toLowerCase() !== 'url' || n.nodes.length === 0) return;
    const inner = n.nodes[0];
    const raw = inner.value;
    const resolved = resolveReference(raw, 'html:style-url', ctx);
    if (resolved) {
      inner.value = resolved.value;
      changed = true;
    }
  });
  return changed ? parsed.toString() : null;
}

/**
 * @typedef {object} RewriteContext
 * @property {string} sourceFile
 * @property {string} baseUrl
 * @property {string} [documentBaseUrl] JS only: fallback base for document-relative forms (fetch/Worker)
 * @property {Array<object>} report
 * @property {'disabled'|'preserve'} [forms]
 * @property {(canonical: string) => (object|null)} lookup
 * @property {(url: URL) => (string|null)} [routeFor]
 * @property {(url: URL) => boolean} isAuthorized
 */

/**
 * Rewrites an HTML document.
 * @param {string} html
 * @param {RewriteContext} ctx
 * @returns {string}
 */
export function rewriteHtml(html, ctx) {
  const document = parse5.parse(html);

  const visit = (node) => {
    if (node.tagName) {
      const tag = node.tagName.toLowerCase();
      const attrs = node.attrs || [];
      const attrByName = new Map(attrs.map((a) => [a.name.toLowerCase(), a]));

      // Single-URL attributes
      for (const attrName of URL_ATTRS[tag] || []) {
        const attr = attrByName.get(attrName);
        if (!attr || attr.value === '') continue;
        const resolved = resolveReference(attr.value, `html:${tag}@${attrName}`, ctx);
        if (resolved) attr.value = resolved.value;
      }

      // srcset / imagesrcset on any element
      for (const attrName of SRCSET_ATTRS) {
        const attr = attrByName.get(attrName);
        if (!attr || attr.value === '') continue;
        const candidates = parseSrcset(attr.value);
        let changed = false;
        const rebuilt = candidates
          .map((c) => {
            const resolved = resolveReference(c.url, `html:${tag}@${attrName}`, ctx);
            if (resolved) {
              changed = true;
              return `${resolved.value}${c.descriptor ? ` ${c.descriptor}` : ''}`;
            }
            return c.raw;
          })
          .join(', ');
        if (changed) attr.value = rebuilt;
      }

      // Form actions: never allow dangerous submission when forms are disabled
      if (tag === 'form' && ctx.forms === 'disabled') {
        const attr = attrByName.get('action');
        if (attr) {
          const original = attr.value;
          report(ctx, { sourceFile: ctx.sourceFile, originalUrl: original, originalValue: original, rewrittenValue: '#', referenceType: 'html:form@action', status: 'rewritten', reason: 'form-neutralized' });
          attr.value = '#';
          if (!attrByName.has('data-original-action')) {
            node.attrs.push({ name: 'data-original-action', value: original });
          }
        }
      }

      // Inline style with url()
      const styleAttr = attrByName.get('style');
      if (styleAttr && /url\s*\(/i.test(styleAttr.value)) {
        const next = rewriteInlineStyle(styleAttr.value, ctx);
        if (next !== null) styleAttr.value = next;
      }

      // <base href> must never be rewritten (would change document resolution)
      if (tag === 'base' && attrByName.has('href')) {
        report(ctx, { sourceFile: ctx.sourceFile, originalUrl: null, originalValue: attrByName.get('href').value, rewrittenValue: null, referenceType: 'html:base@href', status: 'skipped', reason: 'base-tag-preserved' });
      }
    }
    for (const child of node.childNodes || []) visit(child);
  };
  visit(document);

  return parse5.serialize(document);
}
