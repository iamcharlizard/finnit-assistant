/** Waitlist form rules, shared by the form and its server action. */

export type WaitlistError = 'invalid' | 'tooMany' | 'failed';

export type WaitlistState =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; error: WaitlistError; email: string };

/** The hidden field bots fill in and people never see. */
export const HONEYPOT_FIELD = 'company';

export const WAITLIST_IDLE: WaitlistState = { status: 'idle' };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SOURCE = /^[\w.-]{1,64}$/;

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && EMAIL.test(email) ? email : null;
}

/** The campaign that brought the visit (utm_source or ref), if it looks like one. */
export function campaignSource(
  params: Record<string, string | string[] | undefined>,
): string | undefined {
  for (const key of ['utm_source', 'ref']) {
    const value = params[key];
    const text = Array.isArray(value) ? value[0] : value;
    if (text && SOURCE.test(text)) return text.toLowerCase();
  }
  return undefined;
}

export function isCampaignSource(value: unknown): value is string {
  return typeof value === 'string' && SOURCE.test(value);
}
