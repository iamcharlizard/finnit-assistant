import 'server-only';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { ACCESS_COOKIE } from '@/lib/auth/cookies';
import { apiGraphql, isUnauthenticated } from './finnit-api';

/**
 * GraphQL for server components with the signed-in user's token. Without a
 * session (or with a token the API rejects) it goes to /login; any other
 * error throws, and the route's error boundary shows it.
 */
export async function serverGraphql<T>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const accessToken = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!accessToken) redirect('/login');

  const result = await apiGraphql<T>(query, variables, accessToken);
  if (isUnauthenticated(result.errors)) redirect('/login');
  if (!result.data || result.errors?.length) {
    throw new Error(result.errors?.[0]?.message ?? 'The API returned no data');
  }
  return result.data;
}
