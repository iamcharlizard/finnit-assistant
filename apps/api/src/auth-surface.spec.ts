/**
 * Guards the API's public surface: every GraphQL query/mutation/subscription
 * and every REST route needs a JWT guard, except the short list below. A new
 * operation without @UseGuards(JwtAuthGuard) fails here instead of shipping
 * open. Public operations must also be rate-limited.
 */
import 'reflect-metadata';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { GUARDS_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { JwtHttpAuthGuard } from './common/guards/jwt-http-auth.guard';
import { GqlThrottlerGuard } from './common/throttling/gql-throttler.guard';

const RESOLVER_TYPE = 'graphql:resolver_type';

/** Reachable without signing in, on purpose. */
const PUBLIC_OPERATIONS = new Set([
  'AuthResolver.signIn',
  'AuthResolver.signInWithGoogle',
  'AuthResolver.refreshToken',
  'AuthResolver.requestPasswordReset',
  'AuthResolver.resetPassword',
  'AuthResolver.validateToken',
  'WaitlistResolver.joinWaitlist',
  'HealthController.check',
]);
/** Public REST routes (probes) need no rate limit. */
const UNTHROTTLED_PUBLIC = new Set(['HealthController.check']);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(resolver|controller)\.ts$/.test(name) ? [path] : [];
  });
}

interface Operation {
  id: string;
  guards: unknown[];
}

function operations(): Operation[] {
  const found: Operation[] = [];
  for (const file of sourceFiles(__dirname)) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const exports = require(file) as Record<string, unknown>;
    for (const value of Object.values(exports)) {
      if (typeof value !== 'function') continue;
      const cls = value as { name: string; prototype: object };
      const classGuards =
        (Reflect.getMetadata(GUARDS_METADATA, cls) as unknown[]) ?? [];
      for (const key of Object.getOwnPropertyNames(cls.prototype)) {
        if (key === 'constructor') continue;
        const method = (cls.prototype as Record<string, unknown>)[key];
        if (typeof method !== 'function') continue;
        const isGraphql =
          Reflect.getMetadata(RESOLVER_TYPE, method) !== undefined;
        const isRoute =
          Reflect.getMetadata(METHOD_METADATA, method) !== undefined;
        if (!isGraphql && !isRoute) continue;
        const methodGuards =
          (Reflect.getMetadata(GUARDS_METADATA, method) as unknown[]) ?? [];
        found.push({
          id: `${cls.name}.${key}`,
          guards: [...classGuards, ...methodGuards],
        });
      }
    }
  }
  return found;
}

describe('API auth surface', () => {
  const all = operations();

  it('finds the operations', () => {
    expect(all.length).toBeGreaterThan(100);
  });

  it('requires a JWT on everything that is not explicitly public', () => {
    const open = all
      .filter(
        (op) =>
          !op.guards.includes(JwtAuthGuard) &&
          !op.guards.includes(JwtHttpAuthGuard),
      )
      .map((op) => op.id)
      .sort();
    expect(open).toEqual([...PUBLIC_OPERATIONS].sort());
  });

  it('rate-limits every public GraphQL operation', () => {
    const unthrottled = all
      .filter(
        (op) =>
          PUBLIC_OPERATIONS.has(op.id) &&
          !UNTHROTTLED_PUBLIC.has(op.id) &&
          !op.guards.includes(GqlThrottlerGuard),
      )
      .map((op) => op.id);
    expect(unthrottled).toEqual([]);
  });
});
