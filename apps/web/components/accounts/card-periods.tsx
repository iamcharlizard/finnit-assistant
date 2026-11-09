'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { Button } from '@finnit/ui/components/ui/button';
import { cn } from '@finnit/ui/lib/utils';

import { CardPeriodSummary } from '@/components/accounts/card-period-summary';
import {
  CARD_PERIODS_PAGE,
  CARD_PERIODS_QUERY,
  toCardPeriodView,
  type ApiCardPeriod,
  type CardPeriodsResult,
} from '@finnit/core/accounts/card-period';
import { todayKey } from '@finnit/core/finance/dates';
import { gql, requestErrorMessage } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';

/** The cycle to open first: ?period=, else the one being paid, else the running one. */
function initialPick(periods: ApiCardPeriod[], requested: string | null) {
  const asked = periods.find((p) =>
    p.statementDate.startsWith(requested ?? '-'),
  );
  if (asked) return asked.id;
  const paying = periods.find((p) => p.status !== 'open');
  return (paying ?? periods[0])?.id ?? null;
}

/**
 * "Periodos" of a credit card: its billing cycles (de corte a corte), newest
 * first, one at a time with what was owed, paid and is left. Mount it again
 * (React key) when the card's balance changes, so it asks again.
 */
export function CardPeriods({ accountId }: { accountId: string }) {
  const t = useTranslations('cards.period');
  const l = useLocalizer();
  const requested = useSearchParams().get('period');
  const [periods, setPeriods] = React.useState<ApiCardPeriod[] | null>(null);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [picked, setPicked] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchPage = React.useCallback(
    (after: string | null) =>
      gql<CardPeriodsResult>(CARD_PERIODS_QUERY, {
        accountId,
        first: CARD_PERIODS_PAGE,
        after,
      }).then(({ creditCardPeriods }) => ({
        page: creditCardPeriods.edges.map((e) => e.node),
        cursor: creditCardPeriods.pageInfo.endCursor,
      })),
    [accountId],
  );

  React.useEffect(() => {
    let live = true;
    fetchPage(null)
      .then(({ page, cursor: next }) => {
        if (!live) return;
        setPeriods(page);
        setPicked(initialPick(page, requested));
        setCursor(next);
      })
      .catch((e: unknown) => live && setError(requestErrorMessage(e, l.t)));
    return () => {
      live = false;
    };
  }, [fetchPage, requested, l.t]);

  const loadMore = async () => {
    if (!cursor || loading) return;
    setLoading(true);
    setError(null);
    try {
      const { page, cursor: next } = await fetchPage(cursor);
      setPeriods((current) => [...(current ?? []), ...page]);
      setCursor(next);
    } catch (e) {
      setError(requestErrorMessage(e, l.t));
    } finally {
      setLoading(false);
    }
  };

  if (periods === null) {
    return error ? (
      <p role="alert" className="text-sm text-expense">
        {error}
      </p>
    ) : null;
  }

  const today = todayKey();
  const shown = periods.find((p) => p.id === picked) ?? periods[0];

  return (
    <section aria-labelledby="card-periods" className="flex flex-col gap-3">
      <h2 id="card-periods" className="text-base font-bold text-on-background">
        {t('title')}
      </h2>
      {periods.length === 0 ? (
        <p className="text-sm text-on-surface-variant">{t('empty')}</p>
      ) : (
        <>
          <div
            role="tablist"
            aria-label={t('title')}
            className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
          >
            {periods.map((period) => {
              const view = toCardPeriodView(period, today, l);
              const active = period.id === shown?.id;
              return (
                <button
                  key={period.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setPicked(period.id)}
                  className={cn(
                    'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                    active
                      ? 'border-brand/40 bg-brand/10 text-brand-ink'
                      : 'border-glass-border text-on-surface-variant hover:bg-muted',
                  )}
                >
                  {view.range}
                </button>
              );
            })}
            {cursor ? (
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0"
                disabled={loading}
                onClick={() => void loadMore()}
              >
                {t('loadMore')}
              </Button>
            ) : null}
          </div>
          {shown ? (
            <CardPeriodSummary period={toCardPeriodView(shown, today, l)} />
          ) : null}
        </>
      )}
      {error ? (
        <p role="alert" className="text-sm text-expense">
          {error}
        </p>
      ) : null}
    </section>
  );
}
