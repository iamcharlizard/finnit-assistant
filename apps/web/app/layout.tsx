import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';

import '@fontsource/ubuntu/400.css';
import '@fontsource/ubuntu/500.css';
import '@fontsource/ubuntu/700.css';
import './globals.css';

import { AppThemeProvider } from '@/components/app-theme-provider';
import { ThemeProvider } from '@/components/theme-provider';
import { SiteAnalytics } from '@/components/web-analytics/site-analytics';
import { intlLocale } from '@finnit/core/i18n/locales';
import {
  PREVIEW_THEME_COOKIE,
  resolveAppTheme,
  siteTheme,
} from '@finnit/core/theme/app-theme';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return {
    title: { default: t('common.appName'), template: '%s · Finnit' },
    description: t('metadata.description'),
    // public/brand/: an SVG that follows the system's light/dark, PNG and
    // .ico fallbacks, and the home-screen icon for iOS.
    icons: {
      icon: [
        { url: '/brand/finnit-favicon.svg', type: 'image/svg+xml' },
        {
          url: '/brand/finnit-favicon-light-32.png',
          sizes: '32x32',
          type: 'image/png',
          media: '(prefers-color-scheme: light)',
        },
        {
          url: '/brand/finnit-favicon-dark-32.png',
          sizes: '32x32',
          type: 'image/png',
          media: '(prefers-color-scheme: dark)',
        },
      ],
      shortcut: '/brand/favicon.ico',
      apple: '/brand/apple-touch-icon.png',
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8f9fa' },
    { media: '(prefers-color-scheme: dark)', color: '#12131a' },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [locale, store] = await Promise.all([getLocale(), cookies()]);
  // One palette for the site (FINNIT_THEME); an admin's preview cookie
  // overrides it in their browser only. Rendered here, so no flash.
  const site = siteTheme();
  const theme = resolveAppTheme(store.get(PREVIEW_THEME_COOKIE)?.value, site);
  return (
    <html lang={intlLocale(locale)} data-theme={theme} suppressHydrationWarning>
      <body>
        {/* Inherits locale, messages and time zone from i18n/request.ts. */}
        <NextIntlClientProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <AppThemeProvider initialTheme={theme} siteTheme={site}>
              {children}
            </AppThemeProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
        <SiteAnalytics />
      </body>
    </html>
  );
}
