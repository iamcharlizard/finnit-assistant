import type messages from './messages/es.json';
import type { Locale } from './lib/i18n/locales';

// Typed message keys: `t('dashboard.upcoming')` fails to compile on a typo.
// es.json is the reference; lib/i18n/i18n.test.ts checks en.json matches it.
declare module 'next-intl' {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
