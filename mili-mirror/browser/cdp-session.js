// Centralized CDP layer (Milestone: Browser Runtime Strategy).
// CDP is Chromium-only. All CDP usage in the system goes through this stable
// internal interface — never scattered raw CDP calls across agents.
import { redactHeaders } from '../scripts/lib/redact.js';

/**
 * A managed Chrome DevTools Protocol session.
 * Records Network domain events (requests, responses, failures) with redacted
 * headers, lists Service Worker targets when applicable, and always closes cleanly.
 */
export class CdpSession {
  #client = null;
  #listeners = [];
  #closed = false;

  constructor() {
    this.requests = [];
    this.responses = [];
    this.failures = [];
    this.serviceWorkers = [];
  }

  /**
   * Attaches a CDP session to a Playwright page. Chromium only.
   * @param {import('playwright').Page} page
   * @returns {Promise<CdpSession>}
   */
  static async attach(page) {
    const browserType = page.context().browser()?.browserType().name();
    if (browserType !== 'chromium') {
      throw new Error(`CDP é limitado ao Chromium (browserType atual: ${browserType || 'desconhecido'}).`);
    }
    const session = new CdpSession();
    session.#client = await page.context().newCDPSession(page);

    const onRequest = (params) => {
      session.requests.push({
        requestId: params.requestId,
        url: params.request?.url,
        method: params.request?.method,
        type: params.type,
        headers: redactHeaders(params.request?.headers || {}),
      });
    };
    const onResponse = (params) => {
      session.responses.push({
        requestId: params.requestId,
        url: params.response?.url,
        status: params.response?.status,
        mimeType: params.response?.mimeType,
        headers: redactHeaders(params.response?.headers || {}),
      });
    };
    const onFailure = (params) => {
      session.failures.push({
        requestId: params.requestId,
        errorText: params.errorText,
        type: params.type,
        canceled: params.canceled === true,
      });
    };

    session.#client.on('Network.requestWillBeSent', onRequest);
    session.#client.on('Network.responseReceived', onResponse);
    session.#client.on('Network.loadingFailed', onFailure);
    session.#listeners.push(
      ['Network.requestWillBeSent', onRequest],
      ['Network.responseReceived', onResponse],
      ['Network.loadingFailed', onFailure],
    );

    await session.#client.send('Network.enable');
    return session;
  }

  /** Raw send escape hatch for future domains (kept inside this layer). */
  async send(method, params = {}) {
    this.#assertOpen();
    return this.#client.send(method, params);
  }

  /**
   * Lists Service Worker targets registered in this browser (Target domain).
   * @returns {Promise<Array<{targetId:string, url:string, title:string}>>}
   */
  async collectServiceWorkerTargets() {
    this.#assertOpen();
    const { targetInfos } = await this.#client.send('Target.getTargets');
    this.serviceWorkers = targetInfos
      .filter((t) => t.type === 'service_worker')
      .map((t) => ({ targetId: t.targetId, url: t.url, title: t.title }));
    return this.serviceWorkers;
  }

  /** Summary for artifacts (counts + full event lists). */
  summary() {
    return {
      counts: {
        requests: this.requests.length,
        responses: this.responses.length,
        failures: this.failures.length,
        serviceWorkers: this.serviceWorkers.length,
      },
      failures: this.failures,
      serviceWorkers: this.serviceWorkers,
      requests: this.requests,
      responses: this.responses,
    };
  }

  #assertOpen() {
    if (this.#closed || !this.#client) throw new Error('CDP session já encerrada.');
  }

  /** Detaches listeners and closes the session. Idempotent. */
  async close() {
    if (this.#closed) return;
    this.#closed = true;
    if (this.#client) {
      for (const [event, fn] of this.#listeners) {
        this.#client.off(event, fn);
      }
      this.#listeners = [];
      await this.#client.detach().catch(() => {});
      this.#client = null;
    }
  }
}
