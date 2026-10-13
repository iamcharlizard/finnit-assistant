import type { LucideIcon } from 'lucide-react';

/** One figure of the period summary: label, amount and a short detail. */
export function SummaryCard({
  icon: Icon,
  label,
  amount,
  detail,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  amount: string;
  detail: string;
  /** Any CSS color, for the icon and the tint. */
  accent: string;
}) {
  return (
    <section
      className="flex min-w-0 flex-col gap-2 rounded-card border p-4"
      style={{
        backgroundColor: `color-mix(in srgb, ${accent} 6%, transparent)`,
        borderColor: `color-mix(in srgb, ${accent} 22%, transparent)`,
      }}
    >
      <div className="flex items-center gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-surface shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
          <Icon aria-hidden className="size-4" style={{ color: accent }} />
        </span>
        <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-on-surface-variant">
          {label}
        </h2>
      </div>
      <p className="text-2xl font-bold text-on-background tabular-nums">
        {amount}
      </p>
      <p className="text-xs text-on-surface-variant">{detail}</p>
    </section>
  );
}
