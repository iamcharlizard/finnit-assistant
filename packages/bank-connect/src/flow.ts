import { SyncfyConnectClient, SyncfyRequestError } from './client';
import { describeCode, type CodeInfo } from './codes';
import { connectBank } from './connect';
import {
  isNativeSupported,
  personalBanks,
  validateFields,
  type FieldError,
} from './forms';
import { DEFAULT_LOCALE, messagesFor, type Locale } from './messages';
import type { FieldValues, Site, TwofaField } from './types';

/** A bank account returned by registerBankConnection / bankConnections. */
export interface ConnectedAccount {
  id: string;
  name?: string | null;
  mask?: string | null;
  type?: string | null;
  currency?: string | null;
  balance?: number | null;
  /** Finnit account it already imports into, if linked. */
  accountId?: string | null;
}

export interface ConnectedBank {
  id: string;
  institution?: string | null;
  accounts: ConnectedAccount[];
}

/** What each account should import into: a new Finnit account, an existing one, or nothing. */
export type AccountChoice = 'create' | 'skip' | { accountId: string };

/** Calls to the Finnit API; each app implements them with its GraphQL client. */
export interface BankConnectApi {
  createSession(): Promise<{
    token: string;
    widgetScriptUrl: string;
    widgetStylesheetUrl: string;
  }>;
  registerConnection(idCredential: string): Promise<ConnectedBank>;
  linkAccount(
    linkedAccountId: string,
    input: { accountId?: string; createAccount?: boolean },
  ): Promise<void>;
}

export type FlowStep =
  | { name: 'consent' }
  | { name: 'loading'; message: string }
  | { name: 'pickBank'; banks: Site[] }
  | { name: 'credentials'; site: Site; errors: FieldError[]; message?: string }
  | { name: 'connecting'; site: Site; status: CodeInfo }
  | { name: 'twofa'; site: Site; fields: TwofaField[]; errors: FieldError[] }
  | { name: 'linkAccounts'; bank: ConnectedBank; message?: string }
  | { name: 'done'; bank: ConnectedBank; linked: number }
  | {
      name: 'needsWidget';
      site: Site;
      /** Set when the login started natively and must continue in the widget. */
      idCredential?: string;
      token: string;
      widgetScriptUrl: string;
      widgetStylesheetUrl: string;
    }
  | { name: 'error'; message: string; canRetry: boolean };

type Listener = (step: FlowStep) => void;

export interface BankConnectFlowOptions {
  /** fetch used to talk to Syncfy (tests pass a stub). */
  fetchFn?: typeof fetch;
  /** Language of progress, validation and error messages. Default 'es'. */
  locale?: Locale;
}

/**
 * The whole "connect a bank" flow, independent of the UI framework:
 * consent → pick bank → login form → second factors → register in Finnit →
 * choose what each account imports into. Web and React Native render
 * `step` and call the actions.
 *
 * Bank credentials and codes go only to Syncfy (through SyncfyConnectClient).
 */
export class BankConnectFlow {
  private current: FlowStep = { name: 'consent' };
  private readonly listeners = new Set<Listener>();
  private client?: SyncfyConnectClient;
  private session?: Awaited<ReturnType<BankConnectApi['createSession']>>;
  private banks: Site[] = [];
  private pendingTwofa?: {
    fields: TwofaField[];
    resolve: (values: FieldValues) => void;
  };
  private abort?: AbortController;
  /** Accounts linked in this flow, kept across a retry after a failure. */
  private linkedSoFar = 0;
  private readonly fetchFn?: typeof fetch;
  private locale: Locale;

  /** The second argument is the options, or just a fetch (older callers). */
  constructor(
    private readonly api: BankConnectApi,
    options: BankConnectFlowOptions | typeof fetch = {},
  ) {
    const opts = typeof options === 'function' ? { fetchFn: options } : options;
    this.fetchFn = opts.fetchFn;
    this.locale = opts.locale ?? DEFAULT_LOCALE;
  }

  /** Messages produced from now on use this language. */
  setLocale(locale: Locale): void {
    this.locale = locale;
  }

  private get texts() {
    return messagesFor(this.locale);
  }

  get step(): FlowStep {
    return this.current;
  }

  /** Returns an unsubscribe function. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** The user accepted the privacy notice: start a session and load the banks. */
  async acceptConsent(): Promise<void> {
    this.set({ name: 'loading', message: this.texts.flow.loadingBanks });
    try {
      this.session = await this.api.createSession();
      this.client = new SyncfyConnectClient(
        this.session.token,
        this.fetchFn,
        this.locale,
      );
      this.banks = personalBanks(await this.client.listSites());
      this.set({ name: 'pickBank', banks: this.banks });
    } catch (error) {
      this.fail(error, this.texts.flow.banksFailed);
    }
  }

  /** Banks whose name contains `query` (accents and case ignored). */
  search(query: string): Site[] {
    const normalize = (text: string) =>
      text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const q = normalize(query.trim());
    return q
      ? this.banks.filter((b) => normalize(b.name).includes(q))
      : this.banks;
  }

  selectBank(site: Site): void {
    if (!isNativeSupported(site)) {
      this.set({ name: 'needsWidget', site, ...this.session! });
      return;
    }
    this.set({ name: 'credentials', site, errors: [] });
  }

  /** Validates and starts the login. Resolves when the flow leaves the login phase. */
  async submitCredentials(values: FieldValues): Promise<void> {
    const step = this.current;
    if (step.name !== 'credentials' || !this.client) return;
    const errors = validateFields(step.site.credentials, values, this.locale);
    if (errors.length) {
      this.set({ ...step, errors, message: undefined });
      return;
    }

    const site = step.site;
    this.abort = new AbortController();
    this.set({
      name: 'connecting',
      site,
      status: describeCode(100, this.locale),
    });
    try {
      const result = await connectBank(
        this.client,
        site.id_site,
        values,
        {
          signal: this.abort.signal,
          onStatus: (_code, status) => {
            if (this.current.name === 'connecting') {
              this.set({ name: 'connecting', site, status });
            }
          },
          onTwofa: (fields) =>
            new Promise<FieldValues>((resolve, reject) => {
              // Cancelling while the bank waits for a code ends the wait too.
              this.abort?.signal.addEventListener(
                'abort',
                () => {
                  const error = new Error('The connection was cancelled');
                  error.name = 'AbortError';
                  reject(error);
                },
                { once: true },
              );
              this.pendingTwofa = { fields, resolve };
              this.set({ name: 'twofa', site, fields, errors: [] });
            }),
        },
        { locale: this.locale },
      );

      if ('needsWidget' in result) {
        this.set({
          name: 'needsWidget',
          site,
          idCredential: result.idCredential,
          ...this.session!,
        });
      } else if (!result.ok) {
        // Wrong password and similar: back to the form with the bank's message.
        if (result.info.retryable) {
          this.set({
            name: 'credentials',
            site,
            errors: [],
            message: result.info.message,
          });
        } else {
          this.set({
            name: 'error',
            message: result.info.message,
            canRetry: false,
          });
        }
      } else {
        await this.register(result.idCredential);
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      this.fail(error, this.texts.flow.connectFailed);
    } finally {
      this.abort = undefined;
      this.pendingTwofa = undefined;
    }
  }

  /** Answers the second factor the bank asked for. */
  submitTwofa(values: FieldValues): void {
    const step = this.current;
    if (step.name !== 'twofa' || !this.pendingTwofa) return;
    const errors = validateFields(step.fields, values, this.locale);
    if (errors.length) {
      this.set({ ...step, errors });
      return;
    }
    const { resolve } = this.pendingTwofa;
    this.pendingTwofa = undefined;
    this.set({
      name: 'connecting',
      site: step.site,
      status: describeCode(103, this.locale),
    });
    resolve(values);
  }

  /** The widget fallback finished: register the credential it created. */
  async completeWithWidget(idCredential: string): Promise<void> {
    await this.register(idCredential);
  }

  /**
   * Links each account as chosen. Accounts set to 'skip' are left unlinked
   * (they can be linked later from the bank's settings).
   */
  async linkAccounts(choices: Record<string, AccountChoice>): Promise<void> {
    const step = this.current;
    if (step.name !== 'linkAccounts') return;
    // A copy: accounts linked before a failure are marked so a retry skips them.
    const bank: ConnectedBank = {
      ...step.bank,
      accounts: step.bank.accounts.map((a) => ({ ...a })),
    };
    this.set({ name: 'loading', message: this.texts.flow.importing });
    try {
      for (const account of bank.accounts) {
        const choice = choices[account.id] ?? 'skip';
        if (choice === 'skip' || account.accountId) continue;
        await this.api.linkAccount(
          account.id,
          choice === 'create'
            ? { createAccount: true }
            : { accountId: choice.accountId },
        );
        account.accountId = choice === 'create' ? 'new' : choice.accountId;
        this.linkedSoFar += 1;
      }
      const linked = this.linkedSoFar;
      this.set({ name: 'done', bank, linked });
    } catch (error) {
      this.set({
        name: 'linkAccounts',
        bank,
        message: this.messageOf(error, this.texts.flow.linkFailed),
      });
    }
  }

  /** One step back where that makes sense. */
  back(): void {
    const step = this.current;
    if (step.name === 'credentials' || step.name === 'needsWidget') {
      this.set({ name: 'pickBank', banks: this.banks });
    } else if (step.name === 'error' && this.banks.length) {
      this.set({ name: 'pickBank', banks: this.banks });
    } else if (step.name === 'error') {
      this.set({ name: 'consent' });
    }
  }

  /** Stops an ongoing login (e.g. the screen was closed). */
  cancel(): void {
    this.abort?.abort();
    this.pendingTwofa = undefined;
  }

  private async register(idCredential: string): Promise<void> {
    this.set({ name: 'loading', message: this.texts.flow.saving });
    try {
      const bank = await this.api.registerConnection(idCredential);
      this.set({ name: 'linkAccounts', bank });
    } catch (error) {
      this.fail(error, this.texts.flow.saveFailed);
    }
  }

  private fail(error: unknown, fallback: string) {
    this.set({
      name: 'error',
      message: this.messageOf(error, fallback),
      canRetry: true,
    });
  }

  private messageOf(error: unknown, fallback: string): string {
    return error instanceof SyncfyRequestError ? error.message : fallback;
  }

  private set(step: FlowStep) {
    this.current = step;
    for (const listener of this.listeners) listener(step);
  }
}
