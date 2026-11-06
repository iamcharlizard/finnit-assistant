import type messages from '../../messages/es.json';
import type { Locale } from './locales';

// Typed message keys for every app (web: next-intl, mobile: use-intl; both
// read use-intl's AppConfig): `t('dashboard.upcoming')` fails to compile on
// a typo. es.json is the reference; i18n.test.ts checks en.json matches it.
declare module 'use-intl' {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}

export {};
