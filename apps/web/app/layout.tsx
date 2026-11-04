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
import { intlLocale } from '@/lib/i18n/locales';
import { THEME_COOKIE, parseAppTheme } from '@/lib/theme/app-theme';

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
  // The palette comes from a cookie, so the first paint has it (no flash).
  const theme = parseAppTheme(store.get(THEME_COOKIE)?.value);
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
            <AppThemeProvider initialTheme={theme}>{children}</AppThemeProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
