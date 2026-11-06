import { authExchange } from '@urql/exchange-auth';
import { Client, CombinedError, cacheExchange, fetchExchange, mapExchange } from 'urql';

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
