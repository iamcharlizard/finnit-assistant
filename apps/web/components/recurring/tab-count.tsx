import { cn } from '@finnit/ui/lib/utils';

/** Small count next to a tab's name; nothing for zero. */
export function TabCount({
  count,
  highlight = false,
}: {
  count: number;
  /** Draws attention (e.g. pending suggestions). */
  highlight?: boolean;
}) {
  if (count === 0) return null;
  return (
    <span
      className={cn(
        'min-w-5 rounded-full px-1.5 text-center text-[11px] leading-5 font-bold tabular-nums',
        highlight
          ? 'bg-secondary text-secondary-foreground'
          : 'bg-on-background/8 text-on-surface-variant',
      )}
    >
      {count}
    </span>
  );
}
