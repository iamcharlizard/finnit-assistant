import * as React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useTranslations } from 'use-intl';

import {
  CARD_PERIODS_PAGE,
  CARD_PERIODS_QUERY,
  toCardPeriodView,
  type ApiCardPeriod,
  type CardPeriodsResult,
} from '@finnit/core/accounts/card-period';
import { todayKey } from '@finnit/core/finance/dates';
import { requestErrorMessage } from '@finnit/core/graphql/request';
import { cn } from '@finnit/ui-native/lib/utils';
import { TwPressable, TwScrollView, TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Text } from '@finnit/ui-native/components/ui/text';
import { toast } from '@finnit/ui-native/components/ui/toaster';
import { CalendarCog } from 'lucide-react-native';

import { CardPeriodSummary } from '@/components/accounts/card-period-summary';
import { CardTermsSheet } from '@/components/accounts/card-terms-sheet';
import { emitTransactionsChanged } from '@/lib/transactions/events';
import { useGql } from '@/lib/graphql/runner';
import { useLocalizer } from '@/lib/i18n/i18n-provider';

/** ?period=, else the cycle being paid, else the running one. */
function initialPick(periods: ApiCardPeriod[], requested: string | undefined) {
  const asked = requested
    ? periods.find((p) => p.statementDate.startsWith(requested))
    : undefined;
  if (asked) return asked.id;
  return (periods.find((p) => p.status !== 'open') ?? periods[0])?.id ?? null;
}

/**
 * "Periodos" of a credit card (the web's CardPeriods): its billing cycles,
 * newest first, one at a time. Mount it again (React key) when the card's
 * balance changes.
 */
export function CardPeriods({
  accountId,
  terms,
}: {
  accountId: string;
  /** Its cut-off and payment days and rate (edited here: the app has no account editor). */
  terms: {
    statementDay: number | null;
    paymentDueDay: number | null;
    interestRateAnnual: number | null;
  };
}) {
  const t = useTranslations('cards.period');
  const l = useLocalizer();
  const gql = useGql();
  const { period: requested } = useLocalSearchParams<{ period?: string }>();
  const [periods, setPeriods] = React.useState<ApiCardPeriod[] | null>(null);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [picked, setPicked] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState(false);

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
    [accountId, gql],
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

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    try {
      const { page, cursor: next } = await fetchPage(cursor);
      setPeriods((current) => [...(current ?? []), ...page]);
      setCursor(next);
    } catch (e) {
      setError(requestErrorMessage(e, l.t));
    } finally {
      setLoading(false);
    }
  }

  if (periods === null) {
    return error ? <Text className="text-sm text-expense">{error}</Text> : null;
  }
  const today = todayKey();
  const shown = periods.find((p) => p.id === picked) ?? periods[0];

  return (
    <TwView className="gap-3">
      <TwView className="flex-row items-center justify-between gap-2">
        <Text accessibilityRole="header" weight="bold" className="text-base">
          {t('title')}
        </Text>
        <Button
          variant="ghost"
          size="sm"
          icon={CalendarCog}
          label={t('editTerms')}
          onPress={() => setEditing(true)}
        />
      </TwView>
      {periods.length === 0 ? (
        <Text className="text-sm text-on-surface-variant">{t('empty')}</Text>
      ) : (
        <>
          <TwScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2 pr-2"
          >
            {periods.map((period) => {
              const active = period.id === shown?.id;
              return (
                <TwPressable
                  key={period.id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => setPicked(period.id)}
                  className={cn(
                    'min-h-9 justify-center rounded-full border px-3',
                    active
                      ? 'border-brand-40 bg-brand-10'
                      : 'border-glass-border',
                  )}
                >
                  <Text
                    weight="medium"
                    className={cn(
                      'text-xs',
                      active ? 'text-brand-ink' : 'text-on-surface-variant',
                    )}
                  >
                    {toCardPeriodView(period, today, l).range}
                  </Text>
                </TwPressable>
              );
            })}
            {cursor ? (
              <Button
                variant="ghost"
                size="sm"
                label={t('loadMore')}
                disabled={loading}
                onPress={() => void loadMore()}
              />
            ) : null}
          </TwScrollView>
          {shown ? (
            <CardPeriodSummary period={toCardPeriodView(shown, today, l)} />
          ) : null}
        </>
      )}
      {error ? <Text className="text-sm text-expense">{error}</Text> : null}
      {editing ? (
        <CardTermsSheet
          accountId={accountId}
          initial={terms}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            toast.success(t('termsSaved'));
            emitTransactionsChanged(null);
          }}
        />
      ) : null}
    </TwView>
  );
}
