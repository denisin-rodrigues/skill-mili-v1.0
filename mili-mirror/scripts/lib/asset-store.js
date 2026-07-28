// Query-aware, collision-safe asset storage (Milestone: Robust Asset Resolution).
// Local paths are deterministic: derived from the canonical URL, with a short hash
// of the FULL canonical URL appended whenever a query string is present.
import path from 'node:path';
import { shortHash } from './hash.js';
import { canonicalizeUrl, canonicalQuery, decodedPathname } from './url-resolver.js';
import { extForMime } from './mime.js';

const UNSAFE_SEGMENT_CHARS = /[<>:"|?*\\]/g;

/**
 * @typedef {object} AssetEntry
 * @property {string} canonical
 * @property {string} sourceUrl
 * @property {string} host
 * @property {string} localRel
 * @property {string} requestPath
 * @property {string} requestQuery
 * @property {string} contentType
 * @property {string} [kind]
 * @property {boolean} [viaRedirect]
 */

/** Sanitizes one path segment, preserving directory structure and readability. */
function sanitizeSegment(segment) {
  return segment.replace(UNSAFE_SEGMENT_CHARS, '_');
}

/**
 * Computes the deterministic local location for a captured asset.
 * Examples:
 *   https://cdn.example.com/a/b/image.webp?w=640 → mirror/assets/cdn.example.com/a/b/image__q_<hash10>.webp
 *   https://example.com/a/b/style.css            → mirror/assets/example.com/a/b/style.css
 *
 * @param {URL} url resolved absolute URL of the asset
 * @param {string} contentType response content type (used to add a missing extension)
 * @returns {{ localRel: string, requestPath: string, requestQuery: string, canonical: string }}
 */
export function assetLocation(url, contentType) {
  const canonical = canonicalizeUrl(url);
  const host = url.hostname.toLowerCase();
  let pathname = decodedPathname(url) || '/';
  if (pathname.endsWith('/')) pathname = `${pathname}index`;

  const segments = pathname.split('/').filter((s) => s !== '').map(sanitizeSegment);
  let last = segments.pop() || 'index';
  if (!path.posix.extname(last)) {
    const ext = extForMime(contentType);
    if (ext) last += ext;
  }

  const query = canonicalQuery(url);
  if (query !== '') {
    const ext = path.posix.extname(last);
    const base = ext ? last.slice(0, -ext.length) : last;
    // Deterministic hash over the FULL canonical URL (path + query), not just the query
    last = `${base}__q_${shortHash(canonical, 10)}${ext}`;
  }

  const localRel = path.posix.join('mirror', 'assets', host, ...segments, last);
  return {
    localRel,
    requestPath: decodedPathname(url) || '/',
    requestQuery: query,
    canonical,
  };
}

/**
 * Registry of captured assets. Detects sanitize-collisions and resolves them
 * deterministically by appending a content-independent URL hash suffix.
 */
export class AssetRegistry {
  constructor() {
    /** @type {Map<string, AssetEntry>} canonical URL -> asset entry */
    this.byCanonical = new Map();
    /** @type {Map<string, string>} localRel -> canonical URL (collision detection) */
    this.pathOwners = new Map();
  }

  /**
   * @param {string} canonical
   * @returns {AssetEntry|undefined}
   */
  get(canonical) {
    return this.byCanonical.get(canonical);
  }

  has(canonical) {
    return this.byCanonical.has(canonical);
  }

  /**
   * Registers an asset, resolving local-path collisions deterministically.
   * @param {URL} url
   * @param {string} contentType
   * @param {Record<string, any>} [extra] extra fields merged into the entry (kind, sha256, viaRedirect).
   *   `extra.localRel` forces the local path from the start (redirect aliases point at
   *   the final file): path bookkeeping always reflects the final value — no
   *   post-registration mutation (V-03).
   * @returns {AssetEntry} the stored entry (with final localRel)
   */
  register(url, contentType, extra = {}) {
    const canonical = canonicalizeUrl(url);
    const existing = this.byCanonical.get(canonical);
    if (existing) return existing;

    const location = assetLocation(url, contentType);
    const { localRel: forcedLocalRel, ...restExtra } = extra;
    let localRel = forcedLocalRel || location.localRel;

    if (forcedLocalRel) {
      // Intentional sharing (e.g. redirect alias → final file): NOT a collision.
      // Keep the original owner in the bookkeeping (first writer wins).
      if (!this.pathOwners.has(localRel)) this.pathOwners.set(localRel, canonical);
    } else {
      const owner = this.pathOwners.get(localRel);
      if (owner && owner !== canonical) {
        // Two different canonical URLs sanitized to the same local path: disambiguate
        const ext = path.posix.extname(localRel);
        const base = ext ? localRel.slice(0, -ext.length) : localRel;
        localRel = `${base}__c_${shortHash(canonical, 10)}${ext}`;
      }
      this.pathOwners.set(localRel, canonical);
    }

    const entry = {
      canonical,
      sourceUrl: url.toString(),
      host: url.hostname.toLowerCase(),
      localRel,
      requestPath: location.requestPath,
      requestQuery: location.requestQuery,
      contentType: String(contentType || '').split(';')[0],
      ...restExtra,
    };
    this.byCanonical.set(canonical, entry);
    return entry;
  }

  /** @returns {AssetEntry[]} */
  values() {
    return [...this.byCanonical.values()];
  }
}

/**
 * Local URL (on the mirror server) for a captured asset. Identity is encoded in the
 * filename, so these URLs are immune to query-string ambiguity.
 * @param {AssetEntry} entry asset registry entry
 * @param {string|null} fragment optional fragment to re-attach (SVG sprites, etc.)
 * @returns {string}
 */
export function localUrlFor(entry, fragment = null) {
  const rel = String(entry.localRel).replaceAll('\\', '/');
  const prefix = 'mirror/assets/';
  const withoutPrefix = rel.startsWith(prefix) ? rel.slice(prefix.length) : rel;
  const encoded = withoutPrefix.split('/').map(encodeURIComponent).join('/');
  const suffix = fragment ? `#${encodeURI(fragment)}` : '';
  return `/__assets/${encoded}${suffix}`;
}
