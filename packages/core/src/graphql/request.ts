import type { Translate } from '../i18n/translator';

/**
 * Runs a GraphQL document and returns its data (throws GraphqlRequestError).
 * Each app brings its own: the web's `gql` (through /api/graphql), the
 * mobile app's urql client. The `api.ts` modules only take a runner.
 */
export type GqlRunner = <T>(query: string, variables?: Record<string, unknown>) => Promise<T>;

export class GraphqlRequestError extends Error {
  constructor(
    message: string,
    /** The API's GraphQL error code, or NETWORK_ERROR / UNAUTHENTICATED. */
    readonly code?: string,
    /** True when `message` is the API's own text (not one made up here). */
    readonly fromApi = false,
  ) {
    super(message);
    this.name = 'GraphqlRequestError';
  }
}

export const NETWORK_ERROR = 'NETWORK_ERROR';

/**
 * Text to show for a failed request: connection and session problems in
 * the user's language, otherwise the API's message (or a generic one).
 */
export function requestErrorMessage(error: unknown, t: Translate): string {
  if (error instanceof GraphqlRequestError) {
    if (error.code === NETWORK_ERROR) return t('errors.network');
    if (error.code === 'UNAUTHENTICATED') return t('errors.sessionEnded');
    if (error.fromApi && error.message) return error.message;
  }
  return t('errors.unexpected');
}
