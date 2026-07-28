// Context modes (Milestone: Browser Runtime Strategy).
// clean: brand-new BrowserContext per route/run — no personal profile, no extensions,
// isolated cookies/storage. persistent: launchPersistentContext in an EXCLUSIVE
// Mili directory — never the user's personal Chrome/Brave/Edge profile.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { resolveWithin } from '../scripts/lib/safe-path.js';

/** Root of every Mili-owned browser profile (inside the project output dir). */
export function profileRoot(outputDir) {
  return path.join(outputDir, '.mili', 'browser-profiles');
}

/** Well-known personal browser profile locations that must NEVER be used. */
function personalProfileMarkers() {
  return [
    path.join('Google', 'Chrome', 'User Data'),
    path.join('BraveSoftware', 'Brave-Browser', 'User Data'),
    path.join('Microsoft', 'Edge', 'User Data'),
    path.join('.config', 'google-chrome'),
    path.join('.config', 'BraveSoftware'),
    path.join('.mozilla', 'firefox'),
  ];
}

/**
 * Asserts that dir is an EXCLUSIVE Mili profile directory.
 * Rejects personal profiles and anything outside the Mili profile root.
 * @param {string} outputDir project output dir
 * @param {string} dir requested profile dir
 * @returns {string} the safe absolute dir
 */
export function assertExclusiveProfileDir(outputDir, dir) {
  const root = profileRoot(outputDir);
  const resolved = resolveWithin(root, dir);
  if (resolved.ok === false) {
    throw new Error(`Diretório de perfil fora da área exclusiva do Mili (${resolved.reason}): ${dir}`);
  }
  const abs = resolved.abs;
  const home = os.homedir();
  for (const marker of personalProfileMarkers()) {
    if (abs.toLowerCase().startsWith(path.join(home, marker).toLowerCase())) {
      throw new Error(`Perfil pessoal de navegador PROIBIDO como perfil de captura: ${abs}`);
    }
    if (abs.toLowerCase().includes(marker.toLowerCase())) {
      throw new Error(`Diretório parece perfil pessoal de navegador: ${abs}`);
    }
  }
  return abs;
}

/**
 * Clean context: new BrowserContext, isolated cookies/storage, no extensions.
 * Used for discovery, initial capture and every validation pass.
 * @param {import('playwright').Browser} browser
 * @param {object} [opts]
 * @param {{width:number, height:number}} [opts.viewport]
 * @param {boolean} [opts.ignoreHTTPSErrors]
 * @param {Record<string, any>} [opts.extra]
 */
export async function createCleanContext(browser, { viewport, ignoreHTTPSErrors = true, extra = {} } = {}) {
  return browser.newContext({
    viewport,
    ignoreHTTPSErrors,
    ...extra,
  });
}

/**
 * Persistent context: exclusive Mili directory only (warm cache, Service Worker,
 * authorized sessions). Registered in reports; cleanable via command.
 * @param {import('playwright').BrowserType} chromium
 * @param {object} opts
 * @param {string} opts.outputDir
 * @param {string} [opts.profileName]
 * @param {{width:number, height:number}} [opts.viewport]
 * @param {boolean} [opts.headless]
 * @param {Record<string, any>} [opts.extra]
 * @returns {Promise<{context: import('playwright').BrowserContext, dir: string}>}
 */
export async function createPersistentContext(chromium, { outputDir, profileName = 'warm', viewport, headless = true, extra = {} }) {
  const dir = assertExclusiveProfileDir(outputDir, profileName);
  fs.mkdirSync(dir, { recursive: true });
  const context = await chromium.launchPersistentContext(dir, {
    headless,
    viewport,
    ignoreHTTPSErrors: true,
    ...extra,
  });
  return { context, dir };
}

/**
 * Removes every Mili-owned browser profile. Personal profiles are never touched.
 * @returns {{removed:boolean, dir:string, freedBytes:number}}
 */
export function cleanProfiles(outputDir) {
  const root = profileRoot(outputDir);
  if (!fs.existsSync(root)) {
    return { removed: false, dir: root, freedBytes: 0 };
  }
  let freedBytes = 0;
  const walk = (dirPath) => {
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      const full = path.join(dirPath, entry.name);
      if (entry.isDirectory()) walk(full);
      else freedBytes += fs.statSync(full).size;
    }
  };
  walk(root);
  fs.rmSync(root, { recursive: true, force: true });
  return { removed: true, dir: root, freedBytes };
}

/** Lists Mili-owned profiles (for doctor/report). */
export function listProfiles(outputDir) {
  const root = profileRoot(outputDir);
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => path.join(root, e.name));
}
