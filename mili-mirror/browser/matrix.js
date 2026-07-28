// Browser matrix (Milestone: Browser Runtime Strategy).
// capture/browser-matrix.json records every pass: executed, skipped (with reason),
// disabled — and which passes are the official acquisition source.
import fs from 'node:fs';
import path from 'node:path';
import { isoNow, writeJson } from '../scripts/lib/config.js';
import { PASS_DEFINITIONS } from './browser-policy.js';

export const PASS_STATUS = Object.freeze({
  PASSED: 'passed',
  FAILED: 'failed',
  SKIPPED: 'skipped',
  DISABLED: 'disabled',
});

export function matrixPath(project) {
  return path.join(project.dirs.capture, 'browser-matrix.json');
}

export function readMatrix(project) {
  const file = matrixPath(project);
  if (fs.existsSync(file)) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  return {
    acquisitionSource: 'playwright-chromium',
    updatedAt: null,
    passes: [],
  };
}

/**
 * Inserts or replaces a pass record (idempotent by pass id).
 * @param {object} project resolved project
 * @param {{id:string, order?:number, engine:string, distribution?:string,
 *   channel?:string, status:string, reason?:string, officialAcquisition:boolean,
 *   contextMode?:string, cacheState?:string, profileDir?:string,
 *   details?:Record<string, any>}} pass
 */
export function upsertPass(project, pass) {
  if (!PASS_DEFINITIONS.some((definition) => definition.id === pass.id)) {
    throw new Error(`Passe de navegador não modelado: ${pass.id}`);
  }
  const matrix = readMatrix(project);
  const record = {
    reason: undefined,
    distribution: undefined,
    channel: undefined,
    contextMode: undefined,
    cacheState: undefined,
    profileDir: undefined,
    details: undefined,
    ...pass,
    updatedAt: isoNow(),
  };
  Object.keys(record).forEach((k) => record[k] === undefined && delete record[k]);
  const index = matrix.passes.findIndex((p) => p.id === pass.id);
  if (index === -1) matrix.passes.push(record);
  else matrix.passes[index] = record;
  matrix.passes.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  matrix.updatedAt = record.updatedAt;
  writeJson(matrixPath(project), matrix);
  return record;
}
