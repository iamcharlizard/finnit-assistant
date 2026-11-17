import type { LucideIcon } from 'lucide-react';

import { Card } from '@finnit/ui/components/ui/card';
import { Progress } from '@finnit/ui/components/ui/progress';
import { cn } from '@finnit/ui/lib/utils';

/** One figure of the account detail: label, value and a short hint. */
export function AccountStat({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'default',
  progress,
  segments,
  muted = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'expense';
  /** 0–100: draws a bar under the value. */
  progress?: number | null;
  /** Instead of `progress`: a bar of several parts (0–100 each, of the whole bar). */
  segments?: ReadonlyArray<{ key: string; value: number; color: string }>;
  /** The value is a placeholder ("Sin configurar"), not a figure. */
  muted?: boolean;
}) {
  return (
    <Card className="gap-2 rounded-[20px] p-4.5">
      <h3 className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.15em] text-on-surface-variant">
        <Icon aria-hidden className="size-4 text-brand-ink" />
        {label}
      </h3>
      <p
        className={cn(
          'font-bold tabular-nums',
          muted
            ? 'text-base text-on-surface-variant'
            : 'text-2xl text-on-background',
          !muted && tone === 'expense' && 'text-expense',
        )}
      >
        {value}
      </p>
      {segments ? (
        <div
          aria-hidden
          className="flex h-2 w-full gap-[2px] overflow-hidden rounded-full bg-track"
        >
          {segments
            .filter((segment) => segment.value > 0)
            .map((segment) => (
              <span
                key={segment.key}
                style={{
                  width: `${segment.value}%`,
                  background: segment.color,
                }}
              />
            ))}
        </div>
      ) : progress != null ? (
        <Progress
          value={progress}
          aria-label={label}
          indicatorColor={progress >= 90 ? 'var(--expense)' : undefined}
        />
      ) : null}
      {hint ? <p className="text-xs text-on-surface-variant">{hint}</p> : null}
    </Card>
  );
}
