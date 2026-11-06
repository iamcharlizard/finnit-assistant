import { authExchange } from '@urql/exchange-auth';
import { Client, CombinedError, cacheExchange, fetchExchange, mapExchange, type Operation } from 'urql';

import { DEFAULT_LOCALE, type Locale } from '@finnit/core/i18n/locales';

import { GRAPHQL_URL } from '@/lib/api/config';
import { clearSession, privacyUnlockToken, readItem, saveTokens } from '@/lib/session/storage';

const REFRESH_MUTATION = `mutation RefreshToken($input: RefreshTokenInput!) {
  refreshToken(input: $input) { accessToken refreshToken }
}`;

/** The language the API should answer in (category names): set by I18nProvider. */
let requestLocale: Locale = DEFAULT_LOCALE;
export function setRequestLocale(locale: Locale) {
  requestLocale = locale;
}

/** Called when the session can't be renewed (refresh token expired or revoked). */
const sessionEndedListeners = new Set<() => void>();
export function onSessionEnded(listener: () => void): () => void {
  sessionEndedListeners.add(listener);
  return () => sessionEndedListeners.delete(listener);
}

/** Dev only: when each request left for the API, to log how long it took. */
const startedAt = new Map<number, number>();

function operationName(query: Operation['query']): string {
  const def = query.definitions.find((d) => d.kind === 'OperationDefinition');
  return (def && 'name' in def && def.name?.value) || 'anonymous';
}

function isUnauthenticated(error: CombinedError): boolean {
  return (
    error.response?.status === 401 ||
    error.graphQLErrors.some((e) => e.extensions?.code === 'UNAUTHENTICATED')
  );
}

/**
 * The app's GraphQL client. Requests carry the access token (from secure
 * storage), the language and, while unlocked, the privacy token. An
 * UNAUTHENTICATED answer renews the tokens once with the refresh token and
 * retries; if that fails the session ends (back to login).
 */
function createClient(): Client {
  return new Client({
    url: GRAPHQL_URL,
    requestPolicy: 'cache-and-network',
    // Always POST: urql sends short queries as GET by default, and the API's
    // CSRF prevention (Apollo) rejects those with a 400.
    preferGetMethod: false,
    fetchOptions: () => {
      const privacy = privacyUnlockToken();
      return {
        headers: {
          'x-locale': requestLocale,
          ...(privacy ? { 'x-privacy-unlock': privacy } : {}),
        },
      };
    },
    exchanges: [
      cacheExchange,
      authExchange(async (utils) => {
        let accessToken = readItem('accessToken');
        return {
          addAuthToOperation(operation) {
            accessToken = readItem('accessToken');
            return accessToken
              ? utils.appendHeaders(operation, { Authorization: `Bearer ${accessToken}` })
              : operation;
          },
          didAuthError: isUnauthenticated,
          async refreshAuth() {
            const refreshToken = readItem('refreshToken');
            const result = refreshToken
              ? await utils.mutate<{ refreshToken: { accessToken: string; refreshToken: string } }>(
                  REFRESH_MUTATION,
                  { input: { refreshToken } },
                )
              : null;
            if (result?.data?.refreshToken) {
              await saveTokens(result.data.refreshToken);
              accessToken = result.data.refreshToken.accessToken;
              return;
            }
            await clearSession();
            accessToken = null;
            sessionEndedListeners.forEach((listener) => listener());
          },
        };
      }),
      mapExchange({
        // After the cache: only requests that really go to the API get here.
        onOperation(operation) {
          if (!__DEV__ || operation.kind === 'teardown') return;
          startedAt.set(operation.key, Date.now());
          console.log(`[graphql] → ${operationName(operation.query)} (${operation.context.requestPolicy})`);
        },
        onResult(result) {
          if (!__DEV__) return;
          const started = startedAt.get(result.operation.key);
          startedAt.delete(result.operation.key);
          const ms = started ? ` in ${Date.now() - started} ms` : '';
          console.log(`[graphql] ← ${operationName(result.operation.query)}${ms}${result.error ? ' (error)' : ''}`);
        },
        onError(error) {
          if (__DEV__ && !isUnauthenticated(error)) console.warn('[graphql]', error.message);
        },
      }),
      fetchExchange,
    ],
  });
}

export let graphqlClient = createClient();

/** A fresh client (empty cache), e.g. after signing out or another user signs in. */
export function resetGraphqlClient(): Client {
  graphqlClient = createClient();
  return graphqlClient;
}
