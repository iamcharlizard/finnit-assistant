import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

import { apiUrl } from '@/lib/api/finnit-api';
import { ACCESS_COOKIE } from '@/lib/auth/cookies';

const MAX_BODY_BYTES = 100_000;

/**
 * GraphQL for client components. The browser sends queries here with its
 * session cookie; this handler adds the access token (which the browser
 * can't read) and forwards them to the API. proxy.ts has already renewed
 * the token and rejected requests without a session.
 */
export async function POST(request: NextRequest) {
  // Only this site's pages may use the session (defense in depth with SameSite).
  const origin = request.headers.get('origin');
  if (!origin || new URL(origin).host !== request.headers.get('host')) {
    return NextResponse.json(
      { errors: [{ message: 'Forbidden' }] },
      { status: 403 },
    );
  }

  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) {
    return NextResponse.json(
      { errors: [{ message: 'Request too large' }] },
      { status: 413 },
    );
  }

  const accessToken = (await cookies()).get(ACCESS_COOKIE)?.value;
  try {
    const upstream = await fetch(`${apiUrl()}/graphql`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(accessToken && { authorization: `Bearer ${accessToken}` }),
      },
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    });
    return new NextResponse(await upstream.text(), {
      status: upstream.status,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'private, no-store',
      },
    });
  } catch {
    return NextResponse.json(
      { errors: [{ message: 'The Finnit API is unavailable' }] },
      { status: 502 },
    );
  }
}
