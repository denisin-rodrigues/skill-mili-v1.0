// SHA-256 helpers for asset integrity and deduplication.
import crypto from 'node:crypto';
import fs from 'node:fs';

export function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function sha256File(filePath) {
  return sha256Buffer(fs.readFileSync(filePath));
}

export function shortHash(input, length = 8) {
  const hash = typeof input === 'string' ? crypto.createHash('sha256').update(input).digest('hex') : sha256Buffer(input);
  return hash.slice(0, length);
}
