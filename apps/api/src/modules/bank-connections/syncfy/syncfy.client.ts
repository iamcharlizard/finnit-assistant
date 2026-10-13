import { Injectable, Logger } from '@nestjs/common';

const BASE_URL = 'https://api.syncfy.com/v1';
const TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;
const PAGE_SIZE = 200;
/** Hard stop for one listing, far above any real account (avoids runaway paging). */
const MAX_PAGES = 50;

export interface SyncfyUser {
  id_user: string;
  id_external?: string | null;
  name?: string | null;
}

export interface SyncfyCredential {
  id_credential: string;
  id_user: string;
  id_site: string;
  is_authorized: number;
  is_locked: number;
  is_twofa: number;
  can_sync: number;
  /** Seconds until Syncfy accepts a new refresh for this credential. */
  ready_in: number;
  code?: number | null;
  dt_refresh?: number | null;
}

export interface SyncfySite {
  id_site: string;
  name: string;
}

export interface SyncfyAccount {
  id_account: string;
  id_credential: string;
  account_type: string;
  name?: string | null;
  number?: string | null;
  currency?: string | null;
  balance?: number | null;
  extra?: {
    limit?: number | string;
    available?: number | string;
    principal_balance?: number | string;
  } | null;
}

export interface SyncfyTransaction {
  id_transaction: string;
  id_account: string;
  description?: string | null;
  amount: number;
  currency?: string | null;
  is_pending?: number;
  is_disable?: number;
  is_deleted?: number;
  dt_transaction: number;
  dt_refresh?: number | null;
  extra?: {
    dt_operation?: number;
    dt_application?: number;
    balance?: number;
  } | null;
}

export class SyncfyError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

interface Envelope<T> {
  code?: number;
  status?: boolean;
  message?: string | null;
  response: T;
}

/**
 * Minimal Syncfy (formerly Paybook Sync) REST client.
 *
 * - The API key (SYNCFY_API_KEY) only creates users and sessions; everything
 *   else uses a short-lived session token scoped to one Syncfy user.
 * - Bank usernames and passwords never pass through Finnit: users type them
 *   into Syncfy's widget.
 * - Errors never include the API key or tokens.
 */
@Injectable()
export class SyncfyClient {
  private readonly logger = new Logger(SyncfyClient.name);

  constructor(
    private readonly apiKey = process.env.SYNCFY_API_KEY,
    private readonly fetchFn: typeof fetch = fetch,
    private readonly sleep = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms)),
  ) {}

  get isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async listUsers(): Promise<SyncfyUser[]> {
    return this.request<SyncfyUser[]>('GET', '/users', { apiKey: true });
  }

  async createUser(idExternal: string, name: string): Promise<SyncfyUser> {
    return this.request<SyncfyUser>('POST', '/users', {
      apiKey: true,
      body: { id_external: idExternal, name },
    });
  }

  /** Session token for one Syncfy user. Never store it. */
  async createSession(idUser: string): Promise<string> {
    const { token } = await this.request<{ token: string }>(
      'POST',
      '/sessions',
      { apiKey: true, body: { id_user: idUser } },
    );
    return token;
  }

  async listCredentials(token: string): Promise<SyncfyCredential[]> {
    return this.request<SyncfyCredential[]>('GET', '/credentials', { token });
  }

  async listSites(token: string): Promise<SyncfySite[]> {
    return this.request<SyncfySite[]>('GET', '/catalogues/sites', { token });
  }

  /** Asks Syncfy to log in to the bank again and refresh the data (async job). */
  async requestRefresh(token: string, idCredential: string): Promise<void> {
    await this.request(
      'PUT',
      `/credentials/${encodeURIComponent(idCredential)}/pulls`,
      { token },
    );
  }

  async listAccounts(
    token: string,
    idCredential: string,
  ): Promise<SyncfyAccount[]> {
    return this.request<SyncfyAccount[]>(
      'GET',
      `/accounts?id_credential=${encodeURIComponent(idCredential)}`,
      { token },
    );
  }

  /**
   * Transactions of an account, newest first. With `refreshedSince`, only
   * the ones Syncfy added or changed after that moment (incremental sync).
   */
  async listTransactions(
    token: string,
    idAccount: string,
    filter: { refreshedSince?: Date; from?: Date } = {},
  ): Promise<SyncfyTransaction[]> {
    const params = new URLSearchParams({ id_account: idAccount });
    if (filter.refreshedSince) {
      params.set(
        'dt_refresh_from',
        String(Math.floor(filter.refreshedSince.getTime() / 1000)),
      );
    }
    if (filter.from) {
      params.set(
        'dt_transaction_from',
        String(Math.floor(filter.from.getTime() / 1000)),
      );
    }

    const all: SyncfyTransaction[] = [];
    for (let page = 0; page < MAX_PAGES; page += 1) {
      params.set('limit', String(PAGE_SIZE));
      params.set('skip', String(page * PAGE_SIZE));
      const batch = await this.request<SyncfyTransaction[]>(
        'GET',
        `/transactions?${params.toString()}`,
        { token },
      );
      all.push(...batch);
      if (batch.length < PAGE_SIZE) return all;
    }
    this.logger.warn(`Transaction listing stopped after ${MAX_PAGES} pages`);
    return all;
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    auth: { apiKey?: boolean; token?: string; body?: Record<string, unknown> },
  ): Promise<T> {
    if (auth.apiKey && !this.apiKey) {
      throw new SyncfyError('SYNCFY_API_KEY is not set');
    }

    let url = `${BASE_URL}${path}`;
    let body = auth.body;
    if (auth.apiKey) {
      if (method === 'GET' || method === 'DELETE') {
        url += `${url.includes('?') ? '&' : '?'}api_key=${encodeURIComponent(this.apiKey!)}`;
      } else {
        body = { ...body, api_key: this.apiKey };
      }
    }

    for (let attempt = 1; ; attempt += 1) {
      let response: Response;
      try {
        response = await this.fetchFn(url, {
          method,
          headers: {
            'content-type': 'application/json',
            ...(auth.token && { authorization: `Bearer ${auth.token}` }),
          },
          body: body && JSON.stringify(body),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (error) {
        if (attempt < MAX_ATTEMPTS) {
          await this.sleep(this.backoff(attempt));
          continue;
        }
        throw new SyncfyError(
          `Syncfy is unreachable: ${this.scrub((error as Error).message)}`,
        );
      }

      // Rate limited or a transient server error: wait and retry.
      if (
        (response.status === 429 || response.status >= 500) &&
        attempt < MAX_ATTEMPTS
      ) {
        const retryAfter = Number(response.headers.get('retry-after'));
        await this.sleep(
          retryAfter > 0
            ? Math.min(retryAfter, 60) * 1000
            : this.backoff(attempt),
        );
        continue;
      }

      const json = (await response
        .json()
        .catch(() => null)) as Envelope<T> | null;
      if (!response.ok || !json) {
        throw new SyncfyError(
          `Syncfy ${method} ${this.pathOnly(path)} failed with HTTP ${response.status}${
            json?.message ? `: ${this.scrub(json.message)}` : ''
          }`,
          response.status,
        );
      }
      return json.response;
    }
  }

  private backoff(attempt: number): number {
    return 500 * 2 ** (attempt - 1);
  }

  /** Path without query string or ids, for error messages. */
  private pathOnly(path: string): string {
    return path.split('?')[0].replace(/[a-f0-9]{24}/gi, ':id');
  }

  private scrub(text: string): string {
    return this.apiKey ? text.split(this.apiKey).join('***') : text;
  }
}
