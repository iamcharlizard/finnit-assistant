/**
 * Hermes (iOS) has no Intl.PluralRules, which use-intl needs for messages
 * with plurals ("{count, plural, …}"). Polyfilled only where it's missing,
 * with the app's two languages. Import before anything formats a message.
 */
import '@formatjs/intl-pluralrules/polyfill.js';
import '@formatjs/intl-pluralrules/locale-data/es.js';
import '@formatjs/intl-pluralrules/locale-data/en.js';
