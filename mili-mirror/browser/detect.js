// Safe browser detection (Milestone: Browser Runtime Strategy).
// Detection uses Playwright-supported mechanisms only (channels + bundled browsers).
// Never hardcodes machine-specific absolute paths, never downloads browsers silently,
// never substitutes the bundled Playwright Chromium.
import { createRequire } from 'node:module';
import { chromium, firefox } from 'playwright';
import { CdpSession } from './cdp-session.js';

const require = createRequire(import.meta.url);

const DETECT_TIMEOUT_MS = 30000;

/** Playwright package version (from the installed dependency itself). */
export function playwrightVersion() {
  try {
    return require('playwright/package.json').version;
  } catch {
    return 'unknown';
  }
}

/**
 * Bundled Playwright Chromium: the REQUIRED acquisition browser.
 * Also verifies CDP availability with a real session.
 */
export async function detectPlaywrightChromium() {
  let browser = null;
  try {
    browser = await chromium.launch({ headless: true, timeout: DETECT_TIMEOUT_MS });
    const version = browser.version();
    let cdpAvailable = false;
    let context = null;
    try {
      context = await browser.newContext();
      const page = await context.newPage();
      const session = await CdpSession.attach(page);
      cdpAvailable = true;
      await session.close();
    } catch {
      cdpAvailable = false;
    } finally {
      await context?.close().catch(() => {});
    }
    return { available: true, version, playwrightVersion: playwrightVersion(), cdpAvailable };
  } catch (err) {
    return { available: false, reason: err.message, playwrightVersion: playwrightVersion(), cdpAvailable: false };
  } finally {
    await browser?.close().catch(() => {});
  }
}

/**
 * Google Chrome Stable via Playwright channel support.
 * Detection = attempting a real launch (the supported way); no path probing.
 */
export async function detectChromeStable({ headless = true } = {}) {
  let browser = null;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless, timeout: DETECT_TIMEOUT_MS });
    const version = browser.version();
    return { available: true, channel: 'chrome', version };
  } catch {
    return { available: false, channel: 'chrome', reason: 'Chrome Stable not installed' };
  } finally {
    await browser?.close().catch(() => {});
  }
}

/**
 * Firefox via Playwright (only if the user installed it explicitly).
 */
export async function detectFirefox({ headless = true } = {}) {
  let browser = null;
  try {
    browser = await firefox.launch({ headless, timeout: DETECT_TIMEOUT_MS });
    const version = browser.version();
    return { available: true, version };
  } catch {
    return { available: false, reason: 'Firefox not installed (npx playwright install firefox)' };
  } finally {
    await browser?.close().catch(() => {});
  }
}

/**
 * Launches a validation browser for a secondary pass (detection is done by the caller).
 * @param {'chrome'|'firefox'|'chromium'} which
 */
export async function launchValidationBrowser(which, { headless = true } = {}) {
  if (which === 'chrome') return chromium.launch({ channel: 'chrome', headless, timeout: DETECT_TIMEOUT_MS });
  if (which === 'firefox') return firefox.launch({ headless, timeout: DETECT_TIMEOUT_MS });
  if (which === 'chromium') return chromium.launch({ headless, timeout: DETECT_TIMEOUT_MS });
  throw new Error(`Navegador de validação desconhecido: ${which}`);
}
