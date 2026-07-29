import crypto from 'node:crypto';
import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { ensureDir, isoNow } from './config.js';
import { resolveWithin } from './safe-path.js';

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_REDIRECTS = 5;

function requireString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Plano de mídia da Recreation inválido: ${field} deve ser uma string não vazia.`);
  }
}

export function validateRecreationMediaPlan(plan) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    throw new Error('Plano de mídia da Recreation inválido: objeto esperado.');
  }
  if (plan.version !== 1) {
    throw new Error(`Plano de mídia incompatível: version ${plan.version ?? 'ausente'}; esperado 1.`);
  }
  if (!Array.isArray(plan.items) || plan.items.length === 0) {
    throw new Error('Plano de mídia da Recreation inválido: items deve conter pelo menos um asset.');
  }

  const targets = new Set();
  for (const [index, item] of plan.items.entries()) {
    requireString(item?.sourceUrl, `items[${index}].sourceUrl`);
    requireString(item?.target, `items[${index}].target`);
    requireString(item?.alt, `items[${index}].alt`);
    let source;
    try {
      source = new URL(item.sourceUrl);
    } catch {
      throw new Error(`Plano de mídia da Recreation inválido: items[${index}].sourceUrl não é uma URL válida.`);
    }
    if (source.protocol !== 'https:') {
      throw new Error(`Plano de mídia da Recreation inválido: items[${index}].sourceUrl deve usar HTTPS.`);
    }
    const normalizedTarget = item.target.replaceAll('\\', '/');
    if (targets.has(normalizedTarget)) {
      throw new Error(`Plano de mídia da Recreation inválido: target duplicado (${normalizedTarget}).`);
    }
    targets.add(normalizedTarget);
  }
  return plan;
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function downloadImage(urlString, allowlist, maxBytes) {
  return new Promise((resolve, reject) => {
    const request = (current, redirectsLeft, redirectChain) => {
      const url = new URL(current);
      if (url.protocol !== 'https:' || !allowlist.isAllowed(current)) {
        reject(new Error(`URL de mídia não autorizada: ${current}`));
        return;
      }
      const req = https.get(current, { headers: { 'User-Agent': 'mili-mirror/recreation-media' } }, (response) => {
        if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
          response.resume();
          if (redirectsLeft === 0) {
            reject(new Error(`Limite de redirects excedido para ${urlString}.`));
            return;
          }
          const next = new URL(response.headers.location, current).toString();
          request(next, redirectsLeft - 1, [...redirectChain, current]);
          return;
        }
        if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
          response.resume();
          reject(new Error(`Falha HTTP ${response.statusCode || 0} ao adquirir ${current}.`));
          return;
        }
        const declaredLength = Number(response.headers['content-length'] || 0);
        if (declaredLength > maxBytes) {
          response.destroy();
          reject(new Error(`Asset excede o limite individual de ${maxBytes} bytes: ${current}.`));
          return;
        }
        const chunks = [];
        let received = 0;
        response.on('data', (chunk) => {
          received += chunk.length;
          if (received > maxBytes) {
            response.destroy(new Error(`Asset excede o limite individual de ${maxBytes} bytes: ${current}.`));
            return;
          }
          chunks.push(chunk);
        });
        response.on('error', reject);
        response.on('end', () => {
          const contentType = String(response.headers['content-type'] || '').split(';')[0].toLowerCase();
          if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
            reject(new Error(`Tipo de mídia não suportado (${contentType || 'ausente'}): ${current}.`));
            return;
          }
          resolve({
            body: Buffer.concat(chunks),
            contentType,
            finalUrl: current,
            redirectChain,
            status: response.statusCode,
          });
        });
      });
      req.on('error', reject);
      req.setTimeout(120000, () => req.destroy(new Error(`Timeout ao adquirir ${current}.`)));
    };
    request(urlString, MAX_REDIRECTS, []);
  });
}

export async function acquireRecreationMedia({ project, plan, allowlist, output = 'recreation-media' }) {
  validateRecreationMediaPlan(plan);
  const outputResolution = resolveWithin(project.outputDir, output, { checkSymlink: false });
  if (outputResolution.ok === false) {
    throw new Error(`Diretório de mídia da Recreation inválido (${output}): ${outputResolution.reason}.`);
  }
  const mediaRoot = outputResolution.abs;
  ensureDir(mediaRoot);
  const maxTotalBytes = Math.floor((project.config?.capture?.max_total_download_gb ?? 0.5) * 1024 ** 3);
  const maxAssetBytes = Math.min(maxTotalBytes, 25 * 1024 ** 2);
  const records = [];
  let totalBytes = 0;

  for (const item of plan.items) {
    if (!allowlist.isAllowed(item.sourceUrl)) {
      throw new Error(`URL de mídia fora da allowlist: ${item.sourceUrl}`);
    }
    const target = resolveWithin(mediaRoot, item.target, { checkSymlink: false });
    if (target.ok === false) {
      throw new Error(`Destino de mídia inválido (${item.target}): ${target.reason}.`);
    }
    if (fs.existsSync(target.abs)) {
      const body = fs.readFileSync(target.abs);
      records.push({
        sourceUrl: item.sourceUrl,
        localPath: path.relative(project.outputDir, target.abs).replaceAll(path.sep, '/'),
        contentType: item.contentType || null,
        sizeBytes: body.length,
        sha256: sha256(body),
        classification: 'captured',
        acquisitionMethod: 'authorized-direct-download',
        reusedExisting: true,
        alt: item.alt,
      });
      totalBytes += body.length;
      continue;
    }

    const result = await downloadImage(item.sourceUrl, allowlist, maxAssetBytes);
    if (totalBytes + result.body.length > maxTotalBytes) {
      throw new Error(`Aquisição excederia o limite total de ${maxTotalBytes} bytes.`);
    }
    ensureDir(path.dirname(target.abs));
    fs.writeFileSync(target.abs, result.body, { flag: 'wx' });
    totalBytes += result.body.length;
    records.push({
      sourceUrl: item.sourceUrl,
      finalUrl: result.finalUrl,
      localPath: path.relative(project.outputDir, target.abs).replaceAll(path.sep, '/'),
      contentType: result.contentType,
      status: result.status,
      sizeBytes: result.body.length,
      sha256: sha256(result.body),
      classification: 'captured',
      acquisitionMethod: 'authorized-direct-download',
      redirectChain: result.redirectChain,
      reusedExisting: false,
      alt: item.alt,
    });
  }

  return {
    version: 1,
    generatedAt: isoNow(),
    authorizationHash: project.scope?.authorizationHash || null,
    output: path.relative(project.outputDir, mediaRoot).replaceAll(path.sep, '/'),
    totalBytes,
    records,
  };
}
