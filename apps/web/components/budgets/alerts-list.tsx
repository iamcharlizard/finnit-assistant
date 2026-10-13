'use client';

import { useTranslations } from 'next-intl';
import { OctagonAlert, TriangleAlert } from 'lucide-react';

import { cn } from '@finnit/ui/lib/utils';

import type { AlertItem } from '@/lib/budgets/view';

/** Caps at 80% or more of their limit, the fullest first. */
export function AlertsList({ alerts }: { alerts: AlertItem[] }) {
  const t = useTranslations('budgets.alerts');
  if (alerts.length === 0) return null;
  return (
    <section aria-labelledby="budget-alerts" className="flex flex-col gap-2">
      <h2
        id="budget-alerts"
        className="px-1 text-lg font-bold text-on-background"
      >
        {t('title')}
      </h2>
      <ul className="flex flex-col gap-2">
        {alerts.map((alert) => {
          const Icon = alert.status === 'over' ? OctagonAlert : TriangleAlert;
          return (
            <li
              key={alert.categoryId}
              className={cn(
                'flex items-start gap-2 rounded-input border p-3 text-sm text-on-background',
                alert.status === 'over'
                  ? 'border-expense/30 bg-expense/5'
                  : 'border-amber-500/30 bg-amber-500/5',
              )}
            >
              <Icon
                aria-hidden
                className={cn(
                  'mt-0.5 size-4 shrink-0',
                  alert.status === 'over'
                    ? 'text-expense'
                    : 'text-amber-700 dark:text-amber-400',
                )}
              />
              <span>{alert.text}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
