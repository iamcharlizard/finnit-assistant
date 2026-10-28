import 'server-only';

import { getLocale, getTranslations } from 'next-intl/server';

import type { Localizer } from './translator';

/** The request's locale and translator, for server components and loaders. */
export async function getLocalizer(): Promise<Localizer> {
  const [locale, t] = await Promise.all([getLocale(), getTranslations()]);
  return { locale, t };
}
