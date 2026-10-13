import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export const APP_LOCALES = ['es', 'en'] as const;
export type AppLocale = (typeof APP_LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = 'es';

/** Header a client sends to override the user's saved locale. */
export const LOCALE_HEADER = 'x-locale';

export function isAppLocale(value: unknown): value is AppLocale {
  return (
    typeof value === 'string' &&
    (APP_LOCALES as readonly string[]).includes(value)
  );
}

/** 'es-MX' → 'es'; anything unsupported → undefined. */
export function normalizeLocale(value: unknown): AppLocale | undefined {
  if (typeof value !== 'string') return undefined;
  const base = value.trim().toLowerCase().split(/[-_]/)[0];
  return isAppLocale(base) ? base : undefined;
}

export interface LocaleRequest {
  headers?: Record<string, string | string[] | undefined>;
  user?: { locale?: string | null } | null;
}

/**
 * Locale of a request: the `x-locale` header when it is 'es' or 'en', else
 * the signed-in user's saved locale, else Spanish.
 */
export function resolveLocale(req: LocaleRequest | undefined): AppLocale {
  const header = req?.headers?.[LOCALE_HEADER];
  return (
    normalizeLocale(Array.isArray(header) ? header[0] : header) ??
    normalizeLocale(req?.user?.locale) ??
    DEFAULT_LOCALE
  );
}

/** The request's locale in a GraphQL resolver (see `resolveLocale`). */
export const RequestLocale = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AppLocale => {
    const ctx = GqlExecutionContext.create(context);
    return resolveLocale(ctx.getContext<{ req?: LocaleRequest }>().req);
  },
);
