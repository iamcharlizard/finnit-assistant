'use client';

import * as React from 'react';
import { Check, Palette } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@finnit/ui/components/ui/popover';
import { cn } from '@finnit/ui/lib/utils';

import { useAppTheme } from '@/components/app-theme-provider';
import { APP_THEMES, type AppTheme } from '@/lib/theme/app-theme';

/**
 * A small preview of each theme: its background and the surface on top.
 * Fixed colors (light variant), so the swatch looks the same in any theme.
 */
export const THEME_SWATCHES: Record<AppTheme, { bg: string; fg: string }> = {
  finnit: {
    bg: 'linear-gradient(135deg, #f8f9fa 0%, #f8f9fa 50%, #12131a 50%)',
    fg: '#00f5ff',
  },
  glass: {
    bg: 'radial-gradient(70% 70% at 15% 20%, #8ff9ff 0%, transparent 70%), radial-gradient(70% 70% at 90% 30%, #aeb2ec 0%, transparent 70%), radial-gradient(80% 70% at 50% 100%, #7fb7b9 0%, transparent 70%), #e8ebf3',
    fg: 'rgba(255,255,255,0.7)',
  },
  suave: { bg: '#e3e5ea', fg: '#5b61c2' },
  mono: {
    bg: 'linear-gradient(135deg, #ffffff 0%, #ffffff 50%, #111111 50%)',
    fg: '#8a8a8a',
  },
};

export function ThemeSwatch({
  theme,
  className,
}: {
  theme: AppTheme;
  className?: string;
}) {
  const swatch = THEME_SWATCHES[theme];
  return (
    <span
      aria-hidden
      className={cn(
        'relative flex shrink-0 items-end justify-end overflow-hidden rounded-lg border border-black/10 p-1',
        className,
      )}
      style={{ background: swatch.bg }}
    >
      <span
        className="size-2.5 rounded-full shadow-sm"
        style={{ background: swatch.fg }}
      />
    </span>
  );
}

/** Palette button for the top bar: a popover with the four themes. */
export function ThemePicker() {
  const t = useTranslations('ui.theme');
  const { theme, setTheme } = useAppTheme();
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t('change')}
          title={t('change')}
          className="flex size-11 items-center justify-center rounded-full text-on-surface-variant outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Palette aria-hidden className="size-[22px]" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-2">
        <p className="px-2 pt-1 pb-2 text-xs font-medium tracking-wide text-on-surface-variant uppercase">
          {t('label')}
        </p>
        <div
          role="group"
          aria-label={t('label')}
          className="flex flex-col gap-1"
        >
          {APP_THEMES.map((option) => {
            const selected = option === theme;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setTheme(option);
                  setOpen(false);
                }}
                className={cn(
                  'flex min-h-11 items-center gap-3 rounded-xl px-2 py-1.5 text-left outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  selected ? 'bg-primary/15' : 'hover:bg-accent',
                )}
              >
                <ThemeSwatch theme={option} className="size-9" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-medium text-on-background">
                    {t(`names.${option}`)}
                  </span>
                  <span className="truncate text-xs text-on-surface-variant">
                    {t(`descriptions.${option}`)}
                  </span>
                </span>
                {selected ? (
                  <Check aria-hidden className="size-4 text-brand-ink" />
                ) : null}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
