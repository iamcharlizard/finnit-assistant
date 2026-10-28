import { createTranslator } from 'next-intl';

import en from '@/messages/en.json';
import es from '@/messages/es.json';
import type { Locale } from './locales';
import type { Localizer, Translate } from './translator';

const MESSAGES = { es, en };

/** A real translator over the app's messages, for unit tests of view builders. */
export function testLocalizer(locale: Locale = 'es'): Localizer {
  const t = createTranslator({
    locale,
    messages: MESSAGES[locale],
    timeZone: 'America/Mexico_City',
  }) as unknown as Translate;
  return { locale, t };
}
