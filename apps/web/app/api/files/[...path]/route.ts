import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

import { apiUrl } from '@/lib/api/finnit-api';
import { ACCESS_COOKIE } from '@/lib/auth/cookies';
import {
  FORWARDED_RESPONSE_HEADERS,
  PayloadTooLargeError,
  exceedsRequestLimit,
  limitStream,
  matchFileRoute,
} from '@/lib/files/routes';

type Context = { params: Promise<{ path: string[] }> };

const error = (message: string, status: number) =>
  NextResponse.json(
    { message },
    { status, headers: { 'cache-control': 'private, no-store' } },
  );

/**
 * Files for the browser (statements, transaction attachments, receipts).
 * Like /api/graphql, it adds the session's access token (which the browser
 * can't read) and forwards to the API's REST endpoints, streaming both ways.
 * Only the routes in lib/files/routes.ts exist; proxy.ts already renewed
 * the token and answers 401 without a session.
 */
async function forward(request: NextRequest, { params }: Context) {
  const route = matchFileRoute(request.method, (await params).path);
  if (!route) return error('Not found', 404);

  if (route.kind === 'upload') {
    // Only this site's pages may upload with the session (defense in depth with SameSite).
    const origin = request.headers.get('origin');
    if (!origin || new URL(origin).host !== request.headers.get('host')) {
      return error('Forbidden', 403);
    }
    if (exceedsRequestLimit(request.headers.get('content-length'))) {
      return error('File too large', 413);
    }
    const type = request.headers.get('content-type') ?? '';
    if (
      !type.toLowerCase().startsWith('multipart/form-data') ||
      !request.body
    ) {
      return error('Expected multipart/form-data', 415);
    }
  }

  const accessToken = (await cookies()).get(ACCESS_COOKIE)?.value;
  const headers = new Headers();
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);

  let upstream: Response;
  try {
    if (route.kind === 'upload') {
      headers.set('content-type', request.headers.get('content-type')!);
      const length = request.headers.get('content-length');
      if (length) headers.set('content-length', length);
      upstream = await fetch(`${apiUrl()}${route.upstreamPath}`, {
        method: 'POST',
        headers,
        body: limitStream(request.body!),
        // Required by Node's fetch to send a streamed body.
        duplex: 'half',
        cache: 'no-store',
        signal: AbortSignal.timeout(120_000),
      } as RequestInit & { duplex: 'half' });
    } else {
      upstream = await fetch(`${apiUrl()}${route.upstreamPath}`, {
        method: request.method,
        headers,
        cache: 'no-store',
        signal: AbortSignal.timeout(120_000),
      });
    }
  } catch (e) {
    if (
      e instanceof PayloadTooLargeError ||
      (e instanceof Error && e.cause instanceof PayloadTooLargeError)
    ) {
      return error('File too large', 413);
    }
    return error('The Finnit API is unavailable', 502);
  }

  const responseHeaders = new Headers({
    'cache-control': 'private, no-store',
    'x-content-type-options': 'nosniff',
  });
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export const GET = forward;
export const HEAD = forward;
export const POST = forward;
