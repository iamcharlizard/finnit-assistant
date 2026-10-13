/**
 * GraphQL from client components. Goes through this site's /api/graphql,
 * which adds the session token server-side (the browser never holds it).
 */
export class GraphqlRequestError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'GraphqlRequestError';
  }
}

export async function gql<T>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch('/api/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new GraphqlRequestError(
      'No pudimos conectar con Finnit. Revisa tu conexión.',
    );
  }

  if (response.status === 401) {
    // Session ended (e.g. refresh token expired): back to login, then here.
    window.location.assign(
      `/login?next=${encodeURIComponent(window.location.pathname)}`,
    );
    throw new GraphqlRequestError('Tu sesión terminó.', 'UNAUTHENTICATED');
  }

  const json = (await response.json().catch(() => null)) as {
    data?: T;
    errors?: { message: string; extensions?: { code?: string } }[];
  } | null;
  const error = json?.errors?.[0];
  if (error || !json?.data) {
    throw new GraphqlRequestError(
      error?.message ?? 'Ocurrió un error inesperado.',
      error?.extensions?.code,
    );
  }
  return json.data;
}
