import * as React from 'react';
import { ScrollView, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslations } from 'use-intl';
import { CalendarClock, CalendarX, CircleCheck, CreditCard, Landmark } from 'lucide-react-native';

import { buildCalendarSummary, summaryVariables } from '@finnit/core/calendar/summary';
import { fullDate, isDayKey, shortDate, todayKey, weekdayNames, type DayKey } from '@finnit/core/finance/dates';
import { requestErrorMessage } from '@finnit/core/graphql/request';
import { runPaymentAction } from '@finnit/core/recurring/api';
import { RECURRING_QUERY, recurringData, recurringVariables, type RecurringResult } from '@finnit/core/recurring/request';
import { CALENDAR_TABS, parseTab, type CalendarTab } from '@finnit/core/recurring/tabs';
import type { PaymentAction } from '@finnit/core/recurring/types';
import { buildRecurringView, type PaymentItem } from '@finnit/core/recurring/view';
import { TwView } from '@finnit/ui-native/lib/tw';
import { RecurringCalendar } from '@finnit/ui-native/components/finance/recurring-calendar';
import { Button } from '@finnit/ui-native/components/ui/button';
import { EmptyState } from '@finnit/ui-native/components/ui/empty-state';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Segmented } from '@finnit/ui-native/components/ui/segmented';
import { Text } from '@finnit/ui-native/components/ui/text';
import { toast } from '@finnit/ui-native/components/ui/toaster';

import { MonthProgress, MonthsChart, SpendingBars } from '@/components/calendar/summary-charts';
import { PaymentListItem } from '@/components/recurring/payment-list-item';
import { SummaryCard } from '@/components/recurring/summary-card';
import { Screen } from '@/components/shell/screen';
import { useGql } from '@/lib/graphql/runner';
import { useView } from '@/lib/graphql/use-view';
import { useLocalizer } from '@/lib/i18n/i18n-provider';
import { hrefParam } from '@/lib/nav/href';
import { useOnTransactionsChanged } from '@/lib/transactions/events';

const TEAL = '#00696e';
const GREEN = '#00a86b';
const PURPLE = '#6c72cb';

/**
 * Calendario de pagos: the month's scheduled payments and the credit
 * cards' dates on a calendar; and a summary with this month's totals and
 * charts of the next months (the web's /calendar).
 */
export function CalendarScreen() {
  const t = useTranslations();
  const l = useLocalizer();
  const gql = useGql();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ date?: string; tab?: string }>();
  const today = todayKey();
  const date: DayKey = isDayKey(params.date) ? params.date : today;
  const tab = parseTab(CALENDAR_TABS, params.tab);
  const [selectedDay, setSelectedDay] = React.useState<DayKey | null>(null);
  const [busyKey, setBusyKey] = React.useState<string | null>(null);

  const period = useView({
    query: RECURRING_QUERY,
    variables: recurringVariables('month', date),
    build: (data: RecurringResult, loc) => buildRecurringView(recurringData(data), { view: 'month', date, today }, loc),
  });
  const summary = useView({
    query: RECURRING_QUERY,
    variables: summaryVariables(today),
    build: (data: RecurringResult, loc) => buildCalendarSummary(recurringData(data), today, loc),
    pause: tab !== 'summary',
  });
  const refresh = () => {
    period.refresh();
    if (tab === 'summary') summary.refresh();
  };
  useOnTransactionsChanged(refresh);

  const goTo = (href: string) => {
    setSelectedDay(null);
    router.setParams({ date: hrefParam(href, 'date') });
  };

  async function onPaymentAction(item: PaymentItem, action: PaymentAction) {
    if (!item.occurrenceId) return;
    setBusyKey(item.key);
    try {
      await runPaymentAction(action, item.occurrenceId, gql);
      toast.success(t(`recurring.toasts.${action}`, { name: item.name }));
      refresh();
    } catch (e) {
      toast.error(requestErrorMessage(e, l.t));
    } finally {
      setBusyKey(null);
    }
  }

  const view = period.view;
  const payments = view ? (selectedDay ? view.payments.filter((p) => p.day === selectedDay) : view.payments) : [];
  const cardDates = view ? (selectedDay ? view.cardDates.filter((c) => c.day === selectedDay) : view.cardDates) : [];
  const cardWidth = Math.round(width * 0.72);
  const names = weekdayNames(l.locale);
  const active = tab === 'summary' ? summary : period;
  const s = summary.view;

  return (
    <Screen
      title={t('pageTitles.calendar')}
      subtitle={t('calendar.subtitle')}
      loading={active.loading}
      error={active.error}
      refreshing={active.refreshing}
      onRefresh={refresh}
    >
      <TwView className="gap-5">
        <Segmented
          accessibilityLabel={t('calendar.tabs.label')}
          options={CALENDAR_TABS.map((value) => ({ value, label: t(`calendar.tabs.${value}`) }))}
          value={tab}
          onValueChange={(next: CalendarTab) => router.setParams({ tab: next === 'calendar' ? undefined : next })}
        />

        {tab === 'calendar' && view ? (
          <TwView className="gap-4">
            <RecurringCalendar
              month={date}
              events={view.events}
              today={today}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
              onPrevious={() => goTo(view.prevHref)}
              onNext={() => goTo(view.nextHref)}
              onToday={() => goTo(view.todayHref)}
              title={view.periodLabel}
              labels={{
                weekdaysNarrow: names.map((n) => n.slice(0, 1).toUpperCase()),
                previous: t('recurring.calendar.previous.month'),
                next: t('recurring.calendar.next.month'),
                today: t('recurring.calendar.today'),
                eventCount: (count) => t('recurring.calendar.eventCount', { count }),
              }}
            />
            <TwView className="flex-row items-center justify-between gap-2 px-1">
              <Text accessibilityRole="header" weight="bold" className="flex-1 text-base">
                {selectedDay
                  ? t('recurring.panel.dayTitle', { date: fullDate(selectedDay, l.locale) })
                  : t('recurring.panel.periodTitle', { period: view.periodLabel })}
              </Text>
              {selectedDay ? (
                <Button variant="ghost" size="sm" label={t('recurring.panel.showPeriod')} onPress={() => setSelectedDay(null)} />
              ) : null}
            </TwView>
            {cardDates.length > 0 ? (
              <TwView className="gap-2">
                {cardDates.map((item) => (
                  <TwView key={item.id} className="flex-row items-center gap-3 rounded-card border border-outline bg-surface px-4 py-3">
                    <TwView className="size-9 items-center justify-center rounded-xl bg-brand-10">
                      <Icon icon={item.kind === 'payment' ? CalendarClock : CreditCard} size={18} color="--brand-ink" />
                    </TwView>
                    <TwView className="flex-1">
                      <Text weight="medium" className="text-sm">
                        {item.label}
                      </Text>
                      <Text className="text-xs text-on-surface-variant">{shortDate(item.day, l.locale)}</Text>
                    </TwView>
                  </TwView>
                ))}
              </TwView>
            ) : null}
            {payments.length === 0 && cardDates.length === 0 ? (
              <EmptyState icon={CalendarX} title={selectedDay ? t('recurring.panel.emptyDay') : t('recurring.panel.emptyPeriod')} />
            ) : (
              <TwView className="gap-2">
                {payments.map((item) => (
                  <PaymentListItem key={item.key} item={item} busy={busyKey === item.key} onAction={(action) => onPaymentAction(item, action)} />
                ))}
              </TwView>
            )}
          </TwView>
        ) : null}

        {tab === 'summary' && s ? (
          <TwView className="gap-4">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }} snapToInterval={cardWidth + 12} decelerationRate="fast">
              <SummaryCard
                width={cardWidth}
                icon={CalendarClock}
                accent={TEAL}
                label={t('recurring.summary.toPay')}
                amount={s.totals.toPay}
                detail={t('recurring.summary.toPayDetail', { count: s.totals.toPayCount, period: s.monthLabel })}
              />
              <SummaryCard
                width={cardWidth}
                icon={CircleCheck}
                accent={GREEN}
                label={t('recurring.summary.paid')}
                amount={s.totals.paid}
                detail={t('recurring.summary.paidDetail', { count: s.totals.paidCount, period: s.monthLabel })}
              />
              <SummaryCard
                width={cardWidth}
                icon={Landmark}
                accent={PURPLE}
                label={t('recurring.summary.fixedMonthly')}
                amount={s.totals.fixedMonthly}
                detail={t('recurring.summary.fixedMonthlyDetail', { count: s.totals.activeCount })}
              />
            </ScrollView>
            <MonthsChart months={s.months} hasCardEstimate={s.hasCardEstimate} />
            <MonthProgress progress={s.progress} monthLabel={s.monthLabel} />
            <SpendingBars title={t('calendar.summary.byKindTitle')} bars={s.byKind} />
            <SpendingBars title={t('calendar.summary.byAccountTitle')} bars={s.byAccount} />
          </TwView>
        ) : null}
      </TwView>
    </Screen>
  );
}
