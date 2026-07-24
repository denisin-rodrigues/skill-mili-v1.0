// Explicit MIME table used by capture classification and the local server.
import path from 'node:path';

export const MIME_BY_EXT = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jsonl': 'application/x-ndjson; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.bmp': 'image/bmp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.hdr': 'application/octet-stream',
  '.exr': 'application/octet-stream',
  '.ktx': 'image/ktx',
  '.ktx2': 'image/ktx2',
  '.wasm': 'application/wasm',
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.mpd': 'application/dash+xml',
  '.vtt': 'text/vtt; charset=utf-8',
  '.srt': 'application/x-subrip; charset=utf-8',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

export function mimeForPath(filePath) {
  return MIME_BY_EXT[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

export function extForMime(contentType) {
  const base = String(contentType || '').split(';')[0].trim().toLowerCase();
  for (const [ext, mime] of Object.entries(MIME_BY_EXT)) {
    if (mime.split(';')[0] === base) return ext;
  }
  const fallback = {
    'text/html': '.html',
    'text/css': '.css',
    'text/javascript': '.js',
    'application/javascript': '.js',
    'application/json': '.json',
  };
  return fallback[base] || '';
}

/** Asset kinds used in the capture manifest classification. */
export function kindForMime(contentType) {
  const base = String(contentType || '').split(';')[0].trim().toLowerCase();
  if (base.startsWith('text/html')) return 'html';
  if (base.startsWith('text/css')) return 'css';
  if (base.includes('javascript') || base.includes('ecmascript')) return 'js';
  if (base.startsWith('image/')) return 'image';
  if (base.startsWith('font/') || base.includes('font')) return 'font';
  if (base.startsWith('video/') || base.includes('mpegurl') || base.includes('dash')) return 'video';
  if (base.startsWith('audio/')) return 'audio';
  if (base.startsWith('model/')) return 'model';
  if (base.includes('wasm')) return 'wasm';
  if (base.includes('json')) return 'json';
  return 'other';
}
