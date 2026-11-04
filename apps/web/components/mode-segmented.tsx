'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';

import {
  ToggleGroup,
  ToggleGroupItem,
} from '@finnit/ui/components/ui/toggle-group';
import { cn } from '@finnit/ui/lib/utils';

const MODES = [
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
] as const;

/** How long the thumb takes to slide before the theme switches. */
const SLIDE_MS = 250;

/**
 * Light / Dark pill (icon + text) with a thumb that slides under the chosen
 * option. next-themes switches every CSS transition off while it changes
 * the theme (`disableTransitionOnChange`), so the thumb slides first and
 * the theme changes when it lands (at once with reduced motion).
 *
 * The resolved mode is only known on the client: until then no option is
 * pressed, the thumb is hidden and the pill keeps its size.
 */
export function ModeSegmented({
  className,
  id,
}: {
  /** On the wrapper: e.g. `hidden sm:flex`. */
  className?: string;
  id?: string;
}) {
  const t = useTranslations('ui.mode');
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  // The option just picked, shown while the thumb slides to it.
  const [picked, setPicked] = React.useState<string | null>(null);
  const timer = React.useRef<number | undefined>(undefined);
  React.useEffect(() => () => window.clearTimeout(timer.current), []);

  const value = picked ?? (mounted ? (resolvedTheme ?? '') : '');
  const index = MODES.findIndex((m) => m.value === value);

  const pick = (next: string) => {
    if (!next || next === value) return;
    setPicked(next);
    window.clearTimeout(timer.current);
    const reduce = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    timer.current = window.setTimeout(
      () => {
        setTheme(next);
        setPicked(null);
      },
      reduce ? 0 : SLIDE_MS,
    );
  };

  return (
    <div className={cn('inline-flex', className)}>
      <ToggleGroup
        id={id}
        type="single"
        value={value}
        onValueChange={pick}
        aria-label={t('label')}
        // Two equal columns, so the thumb is half the inner width.
        className="relative grid h-11 grid-cols-2 gap-0 rounded-full border border-glass-border bg-muted/70 p-1 shadow-well"
      >
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-surface shadow-[0_1px_6px_rgba(0,0,0,0.12)]',
            'transition-[translate,opacity] duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none',
            index < 0 && 'opacity-0',
            index === 1 && 'translate-x-full',
          )}
        />
        {MODES.map(({ value: mode, icon: Icon }) => (
          <ToggleGroupItem
            key={mode}
            value={mode}
            className={cn(
              'relative z-10 h-full min-h-0 gap-1.5 border-0 bg-transparent px-3 text-[13px] text-on-surface-variant hover:bg-transparent hover:text-on-background',
              'data-[state=on]:bg-transparent data-[state=on]:text-on-background',
              'transition-[color,transform] duration-200 active:scale-95 motion-reduce:transition-none',
            )}
          >
            <Icon aria-hidden className="size-4" />
            {t(mode)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
