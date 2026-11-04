'use client';

import { useTranslations } from 'next-intl';
import { Check, Palette } from 'lucide-react';

import { cn } from '@finnit/ui/lib/utils';

import { useAppTheme } from '@/components/app-theme-provider';
import { ThemeSwatch } from '@/components/theme-picker';
import { APP_THEMES } from '@/lib/theme/app-theme';

/** Settings → Appearance: the four themes as cards with a preview. */
export function ThemeSelect() {
  const t = useTranslations('ui.theme');
  const ts = useTranslations('settings');
  const { theme, setTheme } = useAppTheme();

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-track px-3 py-3">
      <span
        id="theme-select-label"
        className="flex items-center gap-3 text-base text-on-surface-variant"
      >
        <Palette aria-hidden className="size-5 shrink-0" />
        {ts('theme')}
      </span>
      <div
        role="group"
        aria-labelledby="theme-select-label"
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {APP_THEMES.map((option) => {
          const selected = option === theme;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => setTheme(option)}
              className={cn(
                'relative flex flex-col gap-2 rounded-xl border bg-surface p-2 text-left outline-none transition-[border-color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/50',
                selected
                  ? 'border-brand-ink shadow-elevation'
                  : 'border-outline hover:border-on-surface-variant/40',
              )}
            >
              <ThemeSwatch theme={option} className="h-14 w-full" />
              <span className="flex items-center justify-between gap-1 px-0.5 text-sm font-medium text-on-background">
                {t(`names.${option}`)}
                {selected ? (
                  <Check aria-hidden className="size-4 text-brand-ink" />
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
