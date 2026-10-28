import { messagesFor, type Locale } from './messages';

/**
 * Syncfy job status codes (sync-widget/widget/codes.md), with the message
 * shown to the user (Spanish by default, or English).
 */
export type CodeKind = 'progress' | 'waiting' | 'success' | 'error';

export interface CodeInfo {
  kind: CodeKind;
  message: string;
  /** The user can fix it by trying again (e.g. wrong password). */
  retryable: boolean;
}

/** What each known code means; the text comes from messages.ts. */
const CODES: Record<number, Omit<CodeInfo, 'message'>> = {
  100: { kind: 'progress', retryable: false },
  101: { kind: 'progress', retryable: false },
  102: { kind: 'progress', retryable: false },
  103: { kind: 'progress', retryable: false },
  200: { kind: 'success', retryable: false },
  201: { kind: 'success', retryable: false },
  202: { kind: 'success', retryable: false },
  203: { kind: 'success', retryable: false },
  204: { kind: 'success', retryable: false },
  206: { kind: 'success', retryable: false },
  401: { kind: 'error', retryable: true },
  403: { kind: 'error', retryable: true },
  405: { kind: 'error', retryable: false },
  406: { kind: 'error', retryable: true },
  408: { kind: 'error', retryable: true },
  409: { kind: 'error', retryable: true },
  410: { kind: 'waiting', retryable: false },
  411: { kind: 'error', retryable: true },
  413: { kind: 'error', retryable: true },
  500: { kind: 'error', retryable: true },
  501: { kind: 'error', retryable: true },
  504: { kind: 'error', retryable: true },
  509: { kind: 'error', retryable: true },
};

export function describeCode(code: number, locale?: Locale): CodeInfo {
  const messages = messagesFor(locale);
  const known = CODES[code];
  const message = messages.codes[code];
  if (known && message) return { ...known, message };
  if (code >= 200 && code < 300) {
    return {
      kind: 'success',
      message: messages.fallback.success,
      retryable: false,
    };
  }
  if (code < 200) {
    return {
      kind: 'progress',
      message: messages.fallback.progress,
      retryable: false,
    };
  }
  return { kind: 'error', message: messages.fallback.error, retryable: true };
}
