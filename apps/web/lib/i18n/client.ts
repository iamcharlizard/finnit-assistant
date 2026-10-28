'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';

import type { Localizer } from './translator';

/** The page's locale and translator, for client components (stable object). */
export function useLocalizer(): Localizer {
  const locale = useLocale();
  const t = useTranslations();
  return React.useMemo(() => ({ locale, t }), [locale, t]);
}
