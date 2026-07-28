// Central URL resolution module (Milestone: Robust Asset Resolution).
// Single source of truth for classifying, resolving and canonicalizing every URL
// found in HTML, CSS and JavaScript.

/**
 * URL kinds understood by the pipeline.
 * @typedef {'absolute-http'|'protocol-relative'|'root-relative'|'relative'|'fragment-only'|'data'|'blob'|'mailto'|'tel'|'javascript'|'empty'|'other-scheme'} UrlKind
 */

/** Kinds that can never be fetched over HTTP and must never be rewritten. */
const NON_FETCHABLE_KINDS = new Set(['data', 'blob', 'mailto', 'tel', 'javascript', 'fragment-only', 'empty', 'other-scheme']);

/**
 * Classifies a raw URL/reference value without resolving it.
 * @param {string} raw
 * @returns {UrlKind}
 */
export function classifyUrl(raw) {
  const value = String(raw ?? '').trim();
  if (value === '') return 'empty';
  const lower = value.toLowerCase();
  if (lower.startsWith('data:')) return 'data';
  if (lower.startsWith('blob:')) return 'blob';
  if (lower.startsWith('mailto:')) return 'mailto';
  if (lower.startsWith('tel:')) return 'tel';
  if (lower.startsWith('javascript:')) return 'javascript';
  if (value.startsWith('#')) return 'fragment-only';
  if (/^https?:\/\//i.test(value)) return 'absolute-http';
  if (value.startsWith('//')) return 'protocol-relative';
  if (value.startsWith('/')) return 'root-relative';
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return 'other-scheme';
  return 'relative';
}

/**
 * @param {string} raw
 * @returns {boolean} true when the reference must stay byte-identical in output
 */
export function isNonFetchable(raw) {
  return NON_FETCHABLE_KINDS.has(classifyUrl(raw));
}

/**
 * Resolves a raw reference against a base URL (the page/CSS/JS file that contains it).
 * Handles absolute, protocol-relative, root-relative and relative references on any
 * route depth. Non-HTTP references return null.
 * @param {string} raw
 * @param {string} baseUrl absolute URL of the containing document
 * @returns {URL|null}
 */
export function resolveUrl(raw, baseUrl) {
  const kind = classifyUrl(raw);
  if (NON_FETCHABLE_KINDS.has(kind)) return null;
  try {
    if (kind === 'protocol-relative') return new URL(`https:${String(raw).trim()}`);
    return new URL(String(raw).trim(), baseUrl);
  } catch {
    return null;
  }
}

/**
 * Canonical identity of a URL for storage/dedup purposes.
 * - scheme and host lowercased, default ports removed (URL already handles)
 * - fragment REMOVED (never sent to the server; identity is the document)
 * - pathname kept verbatim (case-sensitive, encoded form preserved)
 * - query kept verbatim (order matters for identity — deterministic and collision-safe)
 * @param {URL|string} url
 * @returns {string}
 */
export function canonicalizeUrl(url) {
  const u = typeof url === 'string' ? new URL(url) : url;
  const clone = new URL(u.toString());
  clone.hash = '';
  return clone.toString();
}

/**
 * Extracts the fragment of a raw reference (without '#'), or null.
 * @param {string} raw
 * @returns {string|null}
 */
export function fragmentOf(raw) {
  const idx = String(raw).indexOf('#');
  return idx === -1 ? null : String(raw).slice(idx + 1);
}

/**
 * Query string without '?', canonicalized for exact-match comparisons:
 * preserves pair order and encoding (identity), returns '' when absent.
 * @param {URL} url
 * @returns {string}
 */
export function canonicalQuery(url) {
  return url.search ? url.search.slice(1) : '';
}

/**
 * Decoded pathname for filesystem usage (falls back to raw when malformed).
 * @param {URL} url
 * @returns {string}
 */
export function decodedPathname(url) {
  try {
    return decodeURIComponent(url.pathname);
  } catch {
    return url.pathname;
  }
}
