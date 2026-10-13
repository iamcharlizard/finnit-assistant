import { DonutRing } from '@finnit/ui/components/finance/donut-ring';

/** The goal's progress as a ring with the percentage in the middle. */
export function ProgressRing({
  percent,
  reached,
  size = 72,
  label,
}: {
  percent: number;
  reached: boolean;
  size?: number;
  /** Accessible text, e.g. "45 % ahorrado". */
  label: string;
}) {
  return (
    <div
      role="img"
      aria-label={label}
      className="relative shrink-0"
      style={{ width: size, height: size }}
    >
      <DonutRing
        percentage={percent}
        size={size}
        strokeWidth={Math.max(6, Math.round(size / 10))}
        fillColor={reached ? 'var(--color-green-500)' : 'var(--tertiary)'}
      />
      <span
        aria-hidden
        className="absolute inset-0 flex items-center justify-center text-sm font-bold text-on-background tabular-nums"
      >
        {percent}%
      </span>
    </div>
  );
}
