import { cn } from '../../lib/utils';

interface MonthBar {
  label: string;
  heightPercent: number;
  highlighted?: boolean;
}

interface MonthlyDistributionChartProps {
  title?: string;
  bars?: MonthBar[];
  className?: string;
}

const DEFAULT_BARS: MonthBar[] = [
  { label: 'Ene', heightPercent: 48 },
  { label: 'Feb', heightPercent: 72, highlighted: true },
  { label: 'Mar', heightPercent: 62 },
  { label: 'Abr', heightPercent: 92, highlighted: true },
];

function MonthlyDistributionChart({
  title = 'Distribución Mensual',
  bars = DEFAULT_BARS,
  className,
}: MonthlyDistributionChartProps) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-glass-border bg-glass p-5 backdrop-blur-md',
        className,
      )}
    >
      <h3 className="mb-4 text-[15px] font-medium text-on-surface-variant">
        {title}
      </h3>

      <div
        role="img"
        aria-label={`Gráfico de barras: ${bars.map((b) => `${b.label} ${b.heightPercent}%`).join(', ')}`}
        className="flex h-40 items-end justify-between px-1"
      >
        {bars.map((bar) => (
          <div
            key={bar.label}
            className="flex flex-1 flex-col items-center gap-1.5"
          >
            <div className="flex h-[140px] w-3/5 flex-col justify-end overflow-hidden rounded-t-md bg-track">
              <div
                className={cn(
                  'w-full rounded-t-md',
                  bar.highlighted
                    ? 'bg-highlight/65 shadow-[0_0_10px_var(--highlight)]'
                    : 'bg-highlight/25',
                )}
                style={{ height: `${bar.heightPercent}%` }}
              />
            </div>
            <span className="text-[10px] text-on-surface-variant">
              {bar.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export {
  MonthlyDistributionChart,
  type MonthlyDistributionChartProps,
  type MonthBar,
};
