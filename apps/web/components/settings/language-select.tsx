'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Languages } from 'lucide-react';

import { SettingRow } from '@finnit/ui/components/settings/setting-row';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@finnit/ui/components/ui/select';

import { gql } from '@/lib/graphql/client';
import {
  LOCALES,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE_S,
  isLocale,
  type Locale,
} from '@/lib/i18n/locales';

// Inline input: works whatever the API names its input type.
const UPDATE_PREFERENCES = `mutation UpdateMyPreferences($locale: String!) {
  updateMyPreferences(input: { locale: $locale }) { id }
}`;

/**
 * Español / English. Saves the choice on the account (so every device
 * follows it) and in this browser's NEXT_LOCALE cookie, then re-renders the
 * server components in the new language.
 */
export function LanguageSelect() {
  const t = useTranslations('settings');
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState(false);

  async function change(value: string) {
    if (!isLocale(value) || value === locale) return;
    setError(false);
    document.cookie = `${LOCALE_COOKIE}=${value}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE_S}; samesite=lax`;
    try {
      await gql(UPDATE_PREFERENCES, { locale: value });
    } catch {
      setError(true);
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-col gap-1">
      <SettingRow label={t('language')} icon={Languages} controlId="language">
        <Select
          value={locale}
          disabled={pending}
          onValueChange={(value) => void change(value)}
        >
          <SelectTrigger
            id="language"
            aria-label={t('language')}
            className="min-h-11 w-36"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LOCALES.map((option: Locale) => (
              <SelectItem key={option} value={option} lang={option}>
                {t(`languages.${option}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>
      {error ? (
        <p role="alert" className="px-3 text-[13px] text-expense">
          {t('languageError')}
        </p>
      ) : null}
    </div>
  );
}
