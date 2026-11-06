'use server';

import { cookies } from 'next/headers';

import { apiGraphql } from '@/lib/api/finnit-api';
import { ACCESS_COOKIE } from '@/lib/auth/cookies';
import { PRIVACY_COOKIE, unlockMaxAge } from '@/lib/privacy/cookie';
import { isValidPin } from '@/lib/privacy/pin';

export type UnlockResult =
  | { ok: true }
  | { ok: false; error: 'invalid' | 'wrong' | 'paused' | 'noPin' | 'failed' };

/**
 * Checks the privacy PIN with the API and keeps its unlock token in an
 * httpOnly cookie (until it expires, 10 minutes), so the browser's
 * requests reveal protected automatic names meanwhile.
 */
export async function unlockPrivacy(pin: string): Promise<UnlockResult> {
  if (!isValidPin(pin)) return { ok: false, error: 'invalid' };
  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value;
  if (!accessToken) return { ok: false, error: 'failed' };
  const result = await apiGraphql<{
    unlockPrivacy: { token: string; expiresAt: string };
  }>(
    'mutation UnlockPrivacy($pin: String!) { unlockPrivacy(pin: $pin) { token expiresAt } }',
    { pin },
    accessToken,
  ).catch(() => null);
  const unlock = result?.data?.unlockPrivacy;
  if (!unlock) {
    const message = result?.errors?.[0]?.message ?? '';
    if (/wrong pin/i.test(message)) return { ok: false, error: 'wrong' };
    if (/too many/i.test(message)) return { ok: false, error: 'paused' };
    if (/no privacy pin/i.test(message)) return { ok: false, error: 'noPin' };
    return { ok: false, error: 'failed' };
  }
  store.set(PRIVACY_COOKIE, unlock.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: unlockMaxAge(unlock.expiresAt),
  });
  return { ok: true };
}

/** Locks protected automatic names again before the unlock expires. */
export async function lockPrivacy(): Promise<void> {
  (await cookies()).delete(PRIVACY_COOKIE);
}
