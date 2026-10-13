import { SyncfyConnectClient } from './client';
import { describeCode, type CodeInfo } from './codes';
import { buildValues, isTwofaSupported } from './forms';
import type { Locale } from './messages';
import type { FieldValues, TwofaField } from './types';

export interface ConnectHandlers {
  /** Progress for the UI (e.g. "Sesión iniciada, descargando información…"). */
  onStatus?: (code: number, info: CodeInfo) => void;
  /**
   * The bank asks for a second factor. Resolve with the user's values. For
   * an externalAction (scan a QR…) show it and resolve right away: the flow
   * keeps polling until the bank confirms it.
   * Can be called several times in one connection.
   */
  onTwofa: (fields: TwofaField[]) => Promise<FieldValues>;
  signal?: AbortSignal;
}

export interface ConnectOptions {
  pollIntervalMs?: number;
  /** Give up after this long without a final status (default 5 min). */
  timeoutMs?: number;
  /** Language of the status messages (Spanish by default). */
  locale?: Locale;
}

export type ConnectResult =
  | { ok: true; idCredential: string; code: number; info: CodeInfo }
  | { ok: false; idCredential?: string; code: number; info: CodeInfo }
  | {
      ok: false;
      /** The bank asked for a second factor the native UI can't show: open Syncfy's widget for this credential. */
      needsWidget: true;
      idCredential: string;
      code: 410;
      info: CodeInfo;
    };

/** Plain Error (DOMException and throwIfAborted are missing in React Native). */
function abortError(): Error {
  const error = new Error('The connection was cancelled');
  error.name = 'AbortError';
  return error;
}

function checkAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw abortError();
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(abortError());
      },
      { once: true },
    );
  });

/**
 * Connects a bank with the native form: creates the login in Syncfy, follows
 * the job and asks the user for each second factor the bank requests.
 * On success, register `idCredential` with the Finnit API
 * (`registerBankConnection`).
 */
export async function connectBank(
  client: SyncfyConnectClient,
  idSite: string,
  credentials: FieldValues,
  handlers: ConnectHandlers,
  options: ConnectOptions = {},
): Promise<ConnectResult> {
  const pollIntervalMs = options.pollIntervalMs ?? 2000;
  const { locale } = options;
  const deadline = Date.now() + (options.timeoutMs ?? 5 * 60_000);

  const credential = await client.createCredential(idSite, credentials);
  const answered = new Set<number>();
  let lastCode: number | undefined;

  while (Date.now() < deadline) {
    checkAborted(handlers.signal);
    const statuses = await client.jobStatus(credential.status);
    const last = statuses[statuses.length - 1];

    if (last && last.code !== lastCode) {
      lastCode = last.code;
      handlers.onStatus?.(last.code, describeCode(last.code, locale));
    }

    if (last?.code === 410 && last.twofa && !answered.has(statuses.length)) {
      // Each second-factor round is a new entry in the status list.
      answered.add(statuses.length);
      if (!isTwofaSupported(last.twofa)) {
        return {
          ok: false,
          needsWidget: true,
          idCredential: credential.id_credential,
          code: 410,
          info: describeCode(410, locale),
        };
      }
      const values = await handlers.onTwofa(last.twofa);
      // An external action (e.g. scanning a QR with the bank's app) is
      // detected by Syncfy itself; sending a value would break the job.
      const needsAnswer = last.twofa.some((f) => f.type !== 'externalAction');
      if (needsAnswer) {
        await client.sendTwofa(
          last.address ?? credential.twofa,
          buildValues(last.twofa, values),
        );
      }
    } else if (last && last.code >= 200 && last.code !== 410) {
      const info = describeCode(last.code, locale);
      return info.kind === 'success'
        ? {
            ok: true,
            idCredential: credential.id_credential,
            code: last.code,
            info,
          }
        : {
            ok: false,
            idCredential: credential.id_credential,
            code: last.code,
            info,
          };
    }

    await sleep(pollIntervalMs, handlers.signal);
  }

  return {
    ok: false,
    idCredential: credential.id_credential,
    code: 504,
    info: describeCode(504, locale),
  };
}
