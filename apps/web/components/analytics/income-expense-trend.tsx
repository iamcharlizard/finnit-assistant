import { useTranslations } from 'next-intl';

import type { AnalyticsView } from '@/lib/analytics/view';

/** Income vs expenses per month, as paired bars. */
export function IncomeExpenseTrend({
  months,
}: {
  months: AnalyticsView['trend'];
}) {
  const t = useTranslations('analytics.trend');
  return (
    <section className="rounded-2xl border border-glass-border bg-glass p-5 backdrop-blur-md">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[15px] font-medium text-on-surface-variant">
          {t('title')}
        </h3>
        <div className="flex gap-3 text-[11px] text-on-surface-variant">
          <span className="flex items-center gap-1">
            <span aria-hidden className="size-2 rounded-full bg-income" />
            {t('income')}
          </span>
          <span className="flex items-center gap-1">
            <span aria-hidden className="size-2 rounded-full bg-expense" />
            {t('expenses')}
          </span>
        </div>
      </div>

      <ul className="flex h-44 items-end justify-between gap-2">
        {months.map((m) => (
          <li
            key={m.label}
            className="flex h-full flex-1 flex-col items-center gap-1.5"
            aria-label={t('monthLabel', {
              month: m.label,
              income: m.income,
              expenses: m.expenses,
            })}
          >
            <div className="flex w-full flex-1 items-end justify-center gap-1">
              <span
                title={t('incomeOf', { amount: m.income })}
                className="w-2.5 rounded-t-[3px] bg-income/70 sm:w-3.5"
                style={{ height: `${Math.max(2, m.incomePercent)}%` }}
              />
              <span
                title={t('expensesOf', { amount: m.expenses })}
                className="w-2.5 rounded-t-[3px] bg-expense/70 sm:w-3.5"
                style={{ height: `${Math.max(2, m.expensePercent)}%` }}
              />
            </div>
            <span aria-hidden className="text-[10px] text-on-surface-variant">
              {m.label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
