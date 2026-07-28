// Central safe path resolution (Milestone: Core Hardening).
// Canonical resolution that blocks escapes from the allowed root, handling URL
// encoding, double encoding, Windows/Linux separators, '..', absolute paths and
// symlinks — never relying on plain string prefix comparison alone.
import fs from 'node:fs';
import path from 'node:path';

/**
 * Decodes percent-encoding repeatedly (bounded), defeating double/triple encoding
 * like %252e%252e (%2e%2e → '..'). Invalid sequences are preserved as-is.
 * @param {string} input
 * @param {number} [maxRounds]
 * @returns {string}
 */
export function decodeRepeatedly(input, maxRounds = 3) {
  let out = String(input);
  for (let round = 0; round < maxRounds; round += 1) {
    let next;
    try {
      next = decodeURIComponent(out);
    } catch {
      return out; // malformed encoding: stop, keep last good value
    }
    if (next === out) return out;
    out = next;
  }
  return out;
}

/**
 * True when the path contains a traversal segment after full decoding and
 * separator normalization (both `/` and `\`).
 * @param {string} input raw or decoded path
 * @returns {boolean}
 */
export function hasTraversal(input) {
  const decoded = decodeRepeatedly(input).replaceAll('\\', '/');
  return decoded.split('/').some((segment) => segment === '..');
}

/**
 * True when abs is inside root (or equals root), computed via path.relative on
 * canonical absolute paths — immune to lookalike prefixes ('/root' vs '/rootevil').
 * @param {string} root
 * @param {string} abs
 * @returns {boolean}
 */
export function isWithin(root, abs) {
  const rel = path.relative(root, abs);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * Resolves input inside root, refusing any escape.
 *
 * @param {string} root allowed root directory (will be canonicalized)
 * @param {string} input user-controlled path (HTTP path, CLI arg, config value);
 *   may be URL-encoded (even double-encoded), use either separator, be absolute,
 *   or contain '..'
 * @param {object} [opts]
 * @param {boolean} [opts.checkSymlink] resolve realpath when the target exists (default true)
 * @returns {{ok:true, abs:string} | {ok:false, reason:string}}
 */
export function resolveWithin(root, input, opts = {}) {
  const { checkSymlink = true } = opts;
  const canonicalRoot = path.resolve(root);

  let decoded;
  try {
    decoded = decodeRepeatedly(input);
  } catch {
    return { ok: false, reason: 'malformed-encoding' };
  }
  const normalized = decoded.replaceAll('\\', '/');

  if (hasTraversal(normalized)) return { ok: false, reason: 'traversal' };
  if (path.posix.isAbsolute(normalized) || path.win32.isAbsolute(normalized)) {
    return { ok: false, reason: 'absolute-path' };
  }
  if (normalized.includes('\0')) return { ok: false, reason: 'null-byte' };

  const abs = path.resolve(canonicalRoot, ...normalized.split('/').filter((s) => s !== '' && s !== '.'));
  if (!isWithin(canonicalRoot, abs)) return { ok: false, reason: 'escapes-root' };

  if (checkSymlink && fs.existsSync(abs)) {
    try {
      const realAbs = fs.realpathSync(abs);
      const realRoot = fs.realpathSync(canonicalRoot);
      if (!isWithin(realRoot, realAbs)) return { ok: false, reason: 'symlink-escapes-root' };
    } catch {
      return { ok: false, reason: 'realpath-failed' };
    }
  }

  return { ok: true, abs };
}

/**
 * Resolves a raw HTTP request target (as received on the wire, before any URL
 * parser normalization) to a safe decoded pathname, or rejects it.
 * Use BEFORE new URL(), because WHATWG URL normalization silently collapses '..'.
 *
 * @param {string} rawUrl req.url (may include query string)
 * @returns {{ok:true, pathname:string} | {ok:false, reason:string}}
 */
export function resolveHttpPathname(rawUrl) {
  const rawPath = String(rawUrl).split(/[?#]/)[0];
  if (hasTraversal(rawPath)) return { ok: false, reason: 'traversal' };
  const decoded = decodeRepeatedly(rawPath);
  if (decoded.includes('\0')) return { ok: false, reason: 'null-byte' };
  if (!decoded.startsWith('/')) return { ok: false, reason: 'not-rooted' };
  return { ok: true, pathname: decoded };
}
