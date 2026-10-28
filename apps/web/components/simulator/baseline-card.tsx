import { useTranslations } from 'next-intl';
import { Wallet } from 'lucide-react';

/** "Hoy": the real starting point (balance and monthly averages). */
export function BaselineCard({
  balance,
  income,
  expenses,
  net,
  monthsOfData,
  hasData,
}: {
  balance: string;
  income: string;
  expenses: string;
  net: string;
  monthsOfData: number;
  hasData: boolean;
}) {
  const t = useTranslations('simulator.baseline');
  const items = [
    { label: t('balance'), value: balance },
    { label: t('income'), value: income },
    { label: t('expenses'), value: expenses },
    { label: t('net'), value: net },
  ];
  return (
    <section
      aria-labelledby="simulator-baseline"
      className="flex flex-col gap-3 rounded-card border border-glass-border bg-glass p-4 backdrop-blur-md"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="simulator-baseline"
          className="flex items-center gap-2 text-sm font-bold text-on-background"
        >
          <Wallet aria-hidden className="size-4 text-tertiary" />
          {t('title')}
        </h2>
        <p className="text-xs text-on-surface-variant">
          {t('source', { count: monthsOfData })}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="min-w-0">
            <dt className="text-xs text-on-surface-variant">{item.label}</dt>
            <dd className="truncate text-base font-bold text-on-background tabular-nums sm:text-lg">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
      {!hasData ? (
        <p className="rounded-input bg-highlight/8 p-3 text-xs text-on-background">
          {t('noData')}
        </p>
      ) : null}
    </section>
  );
}
