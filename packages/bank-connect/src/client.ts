import type { CreatedCredential, FieldValues, JobStatus, Site } from './types';

const API_URL = 'https://api.syncfy.com/v1';
/** The session token is only ever sent to Syncfy's own hosts. */
const ALLOWED_HOSTS = /(^|\.)(syncfy\.com|paybook\.com)$/;
const TIMEOUT_MS = 30_000;

export class SyncfyRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'SyncfyRequestError';
  }
}

interface Envelope<T> {
  response: T;
  message?: string | null;
}

/**
 * Talks to Syncfy from the device with a short-lived session token issued
 * by the Finnit API (`createBankWidgetSession`). Bank usernames, passwords
 * and codes go from here straight to Syncfy; Finnit's servers never see them.
 */
export class SyncfyConnectClient {
  constructor(
    private readonly token: string,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
  ) {}

  /** Institutions available for connection (production catalog). */
  async listSites(): Promise<Site[]> {
    return this.request<Site[]>('GET', `${API_URL}/catalogues/sites`);
  }

  /** Starts a login: Syncfy logs in to the bank in the background. */
  async createCredential(
    idSite: string,
    credentials: FieldValues,
  ): Promise<CreatedCredential> {
    return this.request<CreatedCredential>(
      'POST',
      `${API_URL}/credentials/pulls`,
      { id_site: idSite, credentials },
    );
  }

  /** Every status the login job went through, oldest first. */
  async jobStatus(statusUrl: string): Promise<JobStatus[]> {
    return this.request<JobStatus[]>('GET', statusUrl);
  }

  /** Sends what the bank asked for (second factor). */
  async sendTwofa(address: string, values: FieldValues): Promise<void> {
    await this.request('POST', address, { twofa: values });
  }

  private async request<T>(
    method: 'GET' | 'POST',
    url: string,
    body?: unknown,
  ): Promise<T> {
    // Parsed by hand: React Native's URL polyfill lacks `hostname`.
    const hostname = /^https:\/\/([^/?#:]+)(?::\d+)?(?:[/?#]|$)/i.exec(
      url,
    )?.[1];
    if (!hostname || !ALLOWED_HOSTS.test(hostname.toLowerCase())) {
      throw new SyncfyRequestError(
        'Refusing to send the session to an unknown host',
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let response: Response;
    try {
      response = await this.fetchFn(url, {
        method,
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.token}`,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      throw new SyncfyRequestError(
        'No pudimos comunicarnos con el servicio de conexión bancaria',
      );
    } finally {
      clearTimeout(timer);
    }

    const json = (await response
      .json()
      .catch(() => null)) as Envelope<T> | null;
    if (!response.ok || !json) {
      throw new SyncfyRequestError(
        response.status === 401
          ? 'La sesión de conexión expiró; vuelve a intentarlo'
          : 'El servicio de conexión bancaria respondió con un error',
        response.status,
      );
    }
    return json.response;
  }
}
