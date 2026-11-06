import type { ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';
import { clientIp } from './client-ip';

const MINUTE = 60_000;

/** The email an operation is about (sign-in, password reset), if any. */
function targetEmail(context: ExecutionContext): string | undefined {
  if (context.getType<string>() !== 'graphql') return undefined;
  const input = GqlExecutionContext.create(context).getArgs<{
    input?: { email?: unknown };
  }>().input;
  return typeof input?.email === 'string'
    ? input.email.trim().toLowerCase()
    : undefined;
}

/**
 * Two buckets for every throttled operation:
 * - `ip`: per visitor IP, against one machine hammering us;
 * - `account`: per target email, against slow guessing of one password from
 *   many IPs. Operations without an email fall back to the IP.
 * Limits per operation are set with @Throttle on the resolver.
 */
export const THROTTLER_OPTIONS: ThrottlerModuleOptions = {
  throttlers: [
    { name: 'ip', ttl: MINUTE, limit: 20 },
    {
      name: 'account',
      ttl: 15 * MINUTE,
      limit: 10,
      getTracker: (req, context) => {
        const email = targetEmail(context);
        return email ? `email:${email}` : `ip:${clientIp(req)}`;
      },
    },
  ],
};

/** Shorthand for @Throttle({ ip: …, account: … }). */
export function limits(ip: number, account: number) {
  return {
    ip: { limit: ip, ttl: MINUTE },
    account: { limit: account, ttl: 15 * MINUTE },
  };
}
