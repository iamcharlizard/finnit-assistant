'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';

/**
 * Light/dark button for the top bar: shows the theme it switches to. Until
 * the theme is known on the client it renders an empty slot of the same
 * size, so the bar doesn't jump and hydration matches.
 */
export function ThemeToggle() {
  const t = useTranslations('ui');
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const className =
    'flex size-11 items-center justify-center rounded-full text-on-surface-variant outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50';
  if (!mounted) return <span aria-hidden className={className} />;

  const isDark = resolvedTheme === 'dark';
  const label = isDark ? t('lightMode') : t('darkMode');
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={label}
      title={label}
      className={className}
    >
      {isDark ? (
        <Sun aria-hidden className="size-[22px]" />
      ) : (
        <Moon aria-hidden className="size-[22px]" />
      )}
    </button>
  );
}
