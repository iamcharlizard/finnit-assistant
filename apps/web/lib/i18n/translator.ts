import type { _Translator, Messages } from 'next-intl';

import type { Locale } from './locales';

/**
 * A translator for any message key: what `useTranslations()` and
 * `getTranslations()` return without a namespace. Keys and ICU arguments
 * are type-checked against messages/es.json (see global.d.ts).
 */
export type Translate = _Translator<Messages, never>;

/**
 * What view builders need to produce text: the locale (dates, money) and
 * the translator (labels). Server code gets it from `getLocalizer()`,
 * client components from `useLocalizer()`, tests from `testLocalizer()`.
 */
export interface Localizer {
  locale: Locale;
  t: Translate;
}
