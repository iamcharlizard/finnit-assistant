import type { _Translator, Messages } from 'use-intl';

import type {} from './app-config';
import type { Locale } from './locales';

/**
 * A translator for any message key: what `useTranslations()` (web and
 * mobile) and `getTranslations()` (web server) return without a namespace.
 * Keys and ICU arguments are type-checked against messages/es.json (see
 * app-config.ts).
 */
export type Translate = _Translator<Messages, never>;

/**
 * What view builders need to produce text: the locale (dates, money) and
 * the translator (labels). The web gets it from `getLocalizer()` /
 * `useLocalizer()`, the mobile app from its own hook, tests from
 * `testLocalizer()`.
 */
export interface Localizer {
  locale: Locale;
  t: Translate;
}
