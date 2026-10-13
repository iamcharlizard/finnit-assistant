/**
 * The languages Finnit speaks. The locale is not in the URL: it comes from
 * the signed-in user's preference (`User.locale`), then the NEXT_LOCALE
 * cookie, then (signed out) the browser's Accept-Language, then Spanish.
 */
export const LOCALES = ['es', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'es';

/** Remembers the language in this browser (also before signing in). */
export const LOCALE_COOKIE = 'NEXT_LOCALE';
export const LOCALE_COOKIE_MAX_AGE_S = 365 * 24 * 60 * 60;

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && LOCALES.includes(value as Locale);
}

/** BCP 47 tag for the few places that use Intl (e.g. <html lang>, plural rules). */
export function intlLocale(locale: Locale): 'es-MX' | 'en-US' {
  return locale === 'en' ? 'en-US' : 'es-MX';
}

/**
 * Best supported language of an Accept-Language header ("en-US,en;q=0.9,
 * es;q=0.8"), by quality; null when it names none of ours.
 */
export function negotiateLocale(
  header: string | null | undefined,
): Locale | null {
  if (!header) return null;
  const ranked = header
    .split(',')
    .map((part, index) => {
      const [tag = '', ...params] = part.trim().split(';');
      const q = params
        .map((p) => /^\s*q=([\d.]+)\s*$/.exec(p)?.[1])
        .find(Boolean);
      return {
        language: tag.trim().toLowerCase().split('-')[0] ?? '',
        quality: q === undefined ? 1 : Number(q),
        index,
      };
    })
    .filter((r) => r.language && r.quality > 0 && !Number.isNaN(r.quality))
    .sort((a, b) => b.quality - a.quality || a.index - b.index);
  return ranked.map((r) => r.language).find(isLocale) ?? null;
}

/**
 * The locale for a request: the user's saved preference, then the cookie,
 * then (only without a session) the browser's languages, then Spanish.
 */
export function resolveLocale({
  userLocale,
  cookieLocale,
  acceptLanguage,
  signedIn,
}: {
  userLocale?: unknown;
  cookieLocale?: unknown;
  acceptLanguage?: string | null;
  signedIn: boolean;
}): Locale {
  if (isLocale(userLocale)) return userLocale;
  if (isLocale(cookieLocale)) return cookieLocale;
  if (!signedIn) return negotiateLocale(acceptLanguage) ?? DEFAULT_LOCALE;
  return DEFAULT_LOCALE;
}
