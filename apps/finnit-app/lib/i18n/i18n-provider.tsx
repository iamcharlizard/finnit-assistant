import * as React from 'react';
import { getLocales } from 'expo-localization';
import { IntlProvider, useTranslations } from 'use-intl';

import { TIME_ZONE } from '@finnit/core/finance/dates';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@finnit/core/i18n/locales';
import type { Localizer, Translate } from '@finnit/core/i18n/translator';
import en from '@finnit/core/messages/en.json';
import es from '@finnit/core/messages/es.json';

import { setRequestLocale } from '@/lib/graphql/client';
import { readItem, writeItem } from '@/lib/session/storage';

const MESSAGES = { es, en } as const;

/** The device's first language we speak, if any. */
function deviceLocale(): Locale | null {
  for (const entry of getLocales()) {
    if (isLocale(entry.languageCode)) return entry.languageCode;
  }
  return null;
}

/** Before the user is known: the last choice on this device, then the device's language. */
export function initialLocale(): Locale {
  const saved = readItem('locale');
  if (isLocale(saved)) return saved;
  return deviceLocale() ?? DEFAULT_LOCALE;
}

interface LocaleContextValue {
  locale: Locale;
  /** Switches the language now (no restart) and remembers it on this device. */
  setLocale: (locale: Locale) => void;
}

const LocaleContext = React.createContext<LocaleContextValue | null>(null);

/**
 * Spanish and English, like the web: the same message files
 * (@finnit/core/messages), the same ICU syntax and typed keys. Money and
 * dates are formatted by core in America/Mexico_City.
 */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = React.useState<Locale>(initialLocale);

  // Before the first request, so the API answers in this language.
  setRequestLocale(locale);

  const setLocale = React.useCallback((next: Locale) => {
    setRequestLocale(next);
    setLocaleState(next);
    void writeItem('locale', next);
  }, []);

  const value = React.useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  return (
    <LocaleContext.Provider value={value}>
      <IntlProvider locale={locale} messages={MESSAGES[locale]} timeZone={TIME_ZONE}>
        {children}
      </IntlProvider>
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const context = React.useContext(LocaleContext);
  if (!context) throw new Error('useLocale must be used within <I18nProvider>');
  return context;
}

/** What core's view builders need: the locale and a translator for any key. */
export function useLocalizer(): Localizer {
  const { locale } = useLocale();
  const t = useTranslations() as Translate;
  return React.useMemo(() => ({ locale, t }), [locale, t]);
}
