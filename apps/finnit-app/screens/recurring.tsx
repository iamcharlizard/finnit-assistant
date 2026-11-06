import * as React from 'react';
import { ScrollView, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslations } from 'use-intl';
import { CalendarClock, CalendarX, CircleCheck, Landmark, Repeat } from 'lucide-react-native';

import { fullDate, isDayKey, todayKey, weekdayNames, type DayKey } from '@finnit/core/finance/dates';
import { requestErrorMessage } from '@finnit/core/graphql/request';
import { runPaymentAction, setRecurringActive } from '@finnit/core/recurring/api';
import { RECURRING_QUERY, recurringData, recurringVariables, type RecurringResult } from '@finnit/core/recurring/request';
import { parseTabParam, RECURRING_TABS, type RecurringTab } from '@finnit/core/recurring/tabs';
import type { PaymentAction } from '@finnit/core/recurring/types';
import { buildRecurringView, type ExpenseItem, type PaymentItem } from '@finnit/core/recurring/view';
import { TwView } from '@finnit/ui-native/lib/tw';
import { RecurringCalendar } from '@finnit/ui-native/components/finance/recurring-calendar';
import { Button } from '@finnit/ui-native/components/ui/button';
import { EmptyState } from '@finnit/ui-native/components/ui/empty-state';
import { Segmented } from '@finnit/ui-native/components/ui/segmented';
import { Text } from '@finnit/ui-native/components/ui/text';
import { toast } from '@finnit/ui-native/components/ui/toaster';

import { ExpenseCard } from '@/components/recurring/expense-card';
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

/** Pagos recurrentes: totals, the month's calendar with its payments, and the list. */
export function RecurringScreen() {
  const t = useTranslations();
  const l = useLocalizer();
  const gql = useGql();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ date?: string; tab?: string }>();
  const today = todayKey();
  const date: DayKey = isDayKey(params.date) ? params.date : today;
  const tab = parseTabParam(params.tab);
  const [selectedDay, setSelectedDay] = React.useState<DayKey | null>(null);
  const [busyKey, setBusyKey] = React.useState<string | null>(null);

  const { view, loading, error, refreshing, refresh } = useView({
    query: RECURRING_QUERY,
    variables: recurringVariables('month', date),
    build: (data: RecurringResult, loc) => buildRecurringView(recurringData(data), { view: 'month', date, today }, loc),
  });
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

  async function toggleActive(item: ExpenseItem) {
    setBusyKey(item.id);
    try {
      await setRecurringActive(item.id, !item.active, gql);
      toast.success(t(item.active ? 'recurring.toasts.paused' : 'recurring.toasts.resumed', { name: item.name }));
      refresh();
    } catch (e) {
      toast.error(requestErrorMessage(e, l.t));
    } finally {
      setBusyKey(null);
    }
  }

  const payments = view ? (selectedDay ? view.payments.filter((p) => p.day === selectedDay) : view.payments) : [];
  const cardWidth = Math.round(width * 0.72);
  const names = weekdayNames(l.locale);

  return (
    <Screen
      title={t('pageTitles.recurring')}
      subtitle={t('recurring.subtitle')}
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      {view ? (
        <TwView className="gap-5">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }} snapToInterval={cardWidth + 12} decelerationRate="fast">
            <SummaryCard
              width={cardWidth}
              icon={CalendarClock}
              accent={TEAL}
              label={t('recurring.summary.toPay')}
              amount={view.totals.toPay}
              detail={t('recurring.summary.toPayDetail', { count: view.totals.toPayCount, period: view.periodLabel })}
            />
            <SummaryCard
              width={cardWidth}
              icon={CircleCheck}
              accent={GREEN}
              label={t('recurring.summary.paid')}
              amount={view.totals.paid}
              detail={t('recurring.summary.paidDetail', { count: view.totals.paidCount, period: view.periodLabel })}
            />
            <SummaryCard
              width={cardWidth}
              icon={Landmark}
              accent={PURPLE}
              label={t('recurring.summary.fixedMonthly')}
              amount={view.totals.fixedMonthly}
              detail={t('recurring.summary.fixedMonthlyDetail', { count: view.totals.activeCount })}
            />
          </ScrollView>

          <Segmented
            accessibilityLabel={t('recurring.tabs.label')}
            options={RECURRING_TABS.map((value) => ({ value, label: t(`recurring.tabs.${value}`) }))}
            value={tab}
            onValueChange={(next: RecurringTab) => router.setParams({ tab: next === 'calendar' ? undefined : next })}
          />

          {tab === 'calendar' ? (
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
              {payments.length === 0 ? (
                <EmptyState
                  icon={CalendarX}
                  title={selectedDay ? t('recurring.panel.emptyDay') : t('recurring.panel.emptyPeriod')}
                />
              ) : (
                <TwView className="gap-2">
                  {payments.map((item) => (
                    <PaymentListItem
                      key={item.key}
                      item={item}
                      busy={busyKey === item.key}
                      onAction={(action) => onPaymentAction(item, action)}
                    />
                  ))}
                </TwView>
              )}
            </TwView>
          ) : tab === 'list' ? (
            view.expenses.length === 0 ? (
              <EmptyState icon={Repeat} title={t('recurring.list.emptyTitle')} description={t('recurring.list.emptyDescription')} />
            ) : (
              <TwView className="gap-3">
                {view.expenses.map((item) => (
                  <ExpenseCard key={item.id} item={item} busy={busyKey === item.id} onToggleActive={() => toggleActive(item)} />
                ))}
              </TwView>
            )
          ) : (
            <Text className="py-6 text-center text-on-surface-variant">{t('common.comingSoon')}</Text>
          )}
        </TwView>
      ) : null}
    </Screen>
  );
}
