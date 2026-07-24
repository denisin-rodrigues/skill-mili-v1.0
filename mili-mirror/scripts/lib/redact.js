// Secret redaction utilities (CP: LeastPrivilege / MVP-016).
// Cookies, tokens and sensitive headers must never appear in logs or reports.

export const SENSITIVE_HEADERS = [
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token',
  'x-access-token',
  'x-csrf-token',
  'x-xsrf-token',
  'api-key',
  'auth-token',
];

const TOKEN_PATTERNS = [
  /bearer\s+[a-z0-9._~+/=-]+/gi,
  /(?:token|api[_-]?key|secret|password|passwd|pwd)=([^\s&"']+)/gi,
  /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, // JWT
];

export function redactHeaders(headers = {}) {
  const out = {};
  for (const [key, value] of Object.entries(headers)) {
    out[key] = SENSITIVE_HEADERS.includes(key.toLowerCase()) ? '[REDACTED]' : value;
  }
  return out;
}

export function redactString(input) {
  if (typeof input !== 'string') return input;
  let out = input;
  for (const pattern of TOKEN_PATTERNS) {
    out = out.replace(pattern, (match) => (match.includes('=') ? `${match.split('=')[0]}=[REDACTED]` : '[REDACTED]'));
  }
  return out;
}

export function redactRecord(value) {
  if (Array.isArray(value)) return value.map(redactRecord);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (SENSITIVE_HEADERS.includes(key.toLowerCase())) {
        out[key] = '[REDACTED]';
      } else if (key.toLowerCase() === 'headers' && val && typeof val === 'object') {
        out[key] = redactHeaders(val);
      } else {
        out[key] = redactRecord(val);
      }
    }
    return out;
  }
  return redactString(value);
}
