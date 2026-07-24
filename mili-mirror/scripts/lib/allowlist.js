// Domain allowlist enforcement (MVP-015). External origins are blocked by default.

export class Allowlist {
  /**
   * @param {string[]} domains - exact hosts or wildcard entries like "*.example.com"
   */
  constructor(domains = []) {
    this.exact = new Set();
    this.wildcards = [];
    for (const entry of domains) {
      const host = String(entry).trim().toLowerCase();
      if (!host) continue;
      if (host.startsWith('*.')) {
        this.wildcards.push(host.slice(2));
      } else {
        this.exact.add(host);
      }
    }
  }

  isAllowed(urlString) {
    let url;
    try {
      url = new URL(urlString);
    } catch {
      return true; // non-URL schemes (data:, blob:, about:) are handled by the browser
    }
    if (!['http:', 'https:'].includes(url.protocol)) return true;
    const host = url.hostname.toLowerCase();
    if (this.exact.has(host)) return true;
    return this.wildcards.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
  }

  toJSON() {
    return { exact: [...this.exact], wildcards: this.wildcards };
  }
}

export function isLocalhostHost(hostname) {
  const host = String(hostname).toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.localhost');
}
