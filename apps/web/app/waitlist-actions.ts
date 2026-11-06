'use server';

import { getLocale } from 'next-intl/server';

import {
  ApiUnavailableError,
  apiGraphql,
  isRateLimited,
} from '@/lib/api/finnit-api';
import {
  HONEYPOT_FIELD,
  isCampaignSource,
  normalizeEmail,
  type WaitlistState,
} from '@/lib/landing/waitlist';

/**
 * Landing page form: adds the email to the API's waitlist (a public,
 * rate-limited mutation; no session involved).
 */
export async function joinWaitlist(
  _previous: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  const raw = String(formData.get('email') ?? '');
  // Bots get the same answer as people, and nothing is stored.
  if (String(formData.get(HONEYPOT_FIELD) ?? '') !== '') {
    return { status: 'success' };
  }
  const email = normalizeEmail(raw);
  if (!email) return { status: 'error', error: 'invalid', email: raw };

  const source = formData.get('source');
  const locale = await getLocale();
  try {
    const result = await apiGraphql<{ joinWaitlist: { ok: boolean } }>(
      'mutation JoinWaitlist($input: JoinWaitlistInput!) { joinWaitlist(input: $input) { ok } }',
      {
        input: {
          email,
          locale,
          ...(isCampaignSource(source) && { source }),
        },
      },
    );
    if (result.data?.joinWaitlist.ok) return { status: 'success' };
    if (isRateLimited(result.errors)) {
      return { status: 'error', error: 'tooMany', email: raw };
    }
    const invalid = result.errors?.some(
      (e) => e.extensions?.code === 'VALIDATION_ERROR',
    );
    return {
      status: 'error',
      error: invalid ? 'invalid' : 'failed',
      email: raw,
    };
  } catch (error) {
    if (!(error instanceof ApiUnavailableError)) throw error;
    return { status: 'error', error: 'failed', email: raw };
  }
}
