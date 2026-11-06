import 'server-only';

import { cache } from 'react';
import { cookies } from 'next/headers';

import { apiGraphql, type AuthUser } from '@/lib/api/finnit-api';
import { PRIVACY_COOKIE, privacyHeaders } from '@/lib/privacy/cookie';
import { ACCESS_COOKIE } from './cookies';

const ME_FIELDS = 'id name email role isMaster';

/** The API doesn't know `User.locale` yet (validation error naming it). */
function lacksLocaleField(
  errors: { message: string; extensions?: { code?: string } }[] | undefined,
): boolean {
  return Boolean(
    errors?.some(
      (e) =>
        /\blocale\b/.test(e.message) &&
        (e.extensions?.code === 'GRAPHQL_VALIDATION_FAILED' ||
          /cannot query field/i.test(e.message)),
    ),
  );
}

/**
 * The signed-in user, for server components. Once per request (React
 * cache). proxy.ts already renewed the token, so null means no session.
 *
 * `locale` is the user's language preference; an API without that field
 * still works (the query is retried without it and `locale` is null).
 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value;
  if (!accessToken) return null;
  const unlock = privacyHeaders(store.get(PRIVACY_COOKIE)?.value);
  const me = (fields: string, extra = '') =>
    apiGraphql<{ me: AuthUser; privacyStatus?: AuthUser['privacy'] }>(
      `query Me { me { ${fields} } ${extra} }`,
      {},
      accessToken,
      unlock,
    ).catch(() => null);

  let result = await me(
    `${ME_FIELDS} locale avatar { source url version }`,
    'privacyStatus { hasPin unlocked }',
  );
  if (!result?.data?.me && lacksLocaleField(result?.errors)) {
    result = await me(ME_FIELDS);
  }
  const user = result?.data?.me;
  return user
    ? {
        ...user,
        locale: user.locale ?? null,
        privacy: result?.data?.privacyStatus ?? {
          hasPin: false,
          unlocked: false,
        },
      }
    : null;
});

export function isAdmin(user: Pick<AuthUser, 'role'> | null): boolean {
  return user?.role === 'admin';
}
