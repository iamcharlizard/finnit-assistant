import { cn } from '@finnit/ui/lib/utils';

/** A key number of the simulation: label, value and a short note. */
export function StatTile({
  label,
  value,
  note,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  note?: string;
  tone?: 'neutral' | 'good' | 'bad';
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-card border border-glass-border bg-glass p-3 sm:p-4">
      <dt className="text-xs font-bold uppercase tracking-[0.08em] text-on-surface-variant">
        {label}
      </dt>
      <dd
        className={cn(
          'text-lg font-bold tabular-nums sm:text-2xl',
          tone === 'good' && 'text-income',
          tone === 'bad' && 'text-expense',
          tone === 'neutral' && 'text-on-background',
        )}
      >
        {value}
      </dd>
      {note ? (
        <dd className="text-xs text-on-surface-variant">{note}</dd>
      ) : null}
    </div>
  );
}
