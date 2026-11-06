import { cn } from '@finnit/ui/lib/utils';

import type { AppTheme } from '@/lib/theme/app-theme';

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
