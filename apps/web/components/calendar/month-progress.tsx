'use client';

import { useTranslations } from 'next-intl';
import { CircleAlert, CircleCheck, Clock, type LucideIcon } from 'lucide-react';

import type {
  CalendarSummary,
  ProgressPart,
} from '@finnit/core/calendar/summary';
import { ChartCard } from './chart-card';

const PART_STYLE: Record<ProgressPart, { color: string; icon: LucideIcon }> = {
  paid: { color: 'var(--income)', icon: CircleCheck },
  pending: { color: 'var(--on-surface-variant)', icon: Clock },
  overdue: { color: 'var(--expense)', icon: CircleAlert },
};

/** This month: paid, still to pay and overdue, as one split bar. */
export function MonthProgress({
  progress,
  monthLabel,
}: {
  progress: CalendarSummary['progress'];
  monthLabel: string;
}) {
  const t = useTranslations('calendar.summary');
  const shown = progress.parts.filter((p) => p.value > 0);
  return (
    <ChartCard
      title={t('progressTitle', { month: monthLabel })}
      aside={
        <span className="text-sm font-bold text-on-background tabular-nums">
          {progress.total}
        </span>
      }
    >
      {progress.value === 0 ? (
        <p className="text-sm text-on-surface-variant">{t('progressEmpty')}</p>
      ) : (
        <>
          <div
            role="img"
            aria-label={progress.parts
              .map((p) => `${t(`parts.${p.part}`)}: ${p.amount}`)
              .join(', ')}
            className="flex h-3 gap-[2px] overflow-hidden rounded-full bg-track"
          >
            {shown.map((part) => (
              <span
                key={part.part}
                style={{
                  flexGrow: part.value,
                  flexBasis: 0,
                  background: PART_STYLE[part.part].color,
                }}
              />
            ))}
          </div>
          <ul className="grid gap-2 @2xl:grid-cols-3">
            {progress.parts.map((part) => {
              const { icon: Icon, color } = PART_STYLE[part.part];
              return (
                <li
                  key={part.part}
                  className="flex items-center gap-2 rounded-input bg-track px-3 py-2"
                >
                  <Icon
                    aria-hidden
                    className="size-4 shrink-0"
                    style={{ color }}
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-xs text-on-surface-variant">
                      {t(`parts.${part.part}`)} ·{' '}
                      {t('partCount', { count: part.count })}
                    </span>
                    <span className="text-sm font-medium text-on-background tabular-nums">
                      {part.amount}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </ChartCard>
  );
}
