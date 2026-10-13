import 'server-only';

import { cache } from 'react';
import { cookies } from 'next/headers';

import { apiGraphql, type AuthUser } from '@/lib/api/finnit-api';
import { ACCESS_COOKIE } from './cookies';

/**
 * The signed-in user, for server components. Once per request (React
 * cache). proxy.ts already renewed the token, so null means no session.
 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const accessToken = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!accessToken) return null;
  const result = await apiGraphql<{ me: AuthUser }>(
    'query Me { me { id name email role isMaster } }',
    {},
    accessToken,
  ).catch(() => null);
  return result?.data?.me ?? null;
});

export function isAdmin(user: Pick<AuthUser, 'role'> | null): boolean {
  return user?.role === 'admin';
}
