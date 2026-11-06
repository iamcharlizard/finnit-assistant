import type { Locale } from './locales';

/**
 * The messages of a language, loaded on demand (one JSON file per locale,
 * shared by the web and the mobile app).
 */
export async function loadMessages(locale: Locale) {
  return locale === 'en'
    ? (await import('../../messages/en.json')).default
    : (await import('../../messages/es.json')).default;
}
