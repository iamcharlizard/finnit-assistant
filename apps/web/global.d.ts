import type messages from '@finnit/core/messages/es.json';
import type { Locale } from '@finnit/core/i18n/locales';

// Typed message keys: `t('dashboard.upcoming')` fails to compile on a typo.
// es.json is the reference (in @finnit/core, which declares the same keys
// for use-intl); its i18n.test.ts checks en.json matches it.
declare module 'next-intl' {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
