'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
  RecurringCalendar,
  type RecurringCalendarLabels,
} from '@finnit/ui/components/finance/recurring-calendar';
import { toast } from '@finnit/ui/components/ui/toaster';
import { cn } from '@finnit/ui/lib/utils';

import {
  ExpenseDialog,
  type ExpenseDialogSubject,
} from '@/components/recurring/expense-dialog';
import { PaymentList } from '@/components/recurring/payment-list';
import {
  longDate,
  monthNames,
  shortDate,
  weekdayNames,
} from '@finnit/core/finance/dates';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import {
  recurringErrorMessage,
  runPaymentAction,
  type PaymentAction,
} from '@finnit/core/recurring/api';
import { calendarHref, inRange } from '@finnit/core/recurring/range';
import type {
  PaymentItem,
  RecurringScreenView,
} from '@finnit/core/recurring/view';

/**
 * The payments calendar (month, week or day) and, beside it, the period's
 * or the chosen day's payments with their actions (pay, skip, edit) and
 * the credit cards' cut-off and due dates.
 */
export function PaymentsCalendar({ data }: { data: RecurringScreenView }) {
  const router = useRouter();
  const l = useLocalizer();
  const { t, locale } = l;
  const [pending, startTransition] = React.useTransition();
  const [selectedDay, setSelectedDay] = React.useState<string | null>(null);
  const [dialog, setDialog] = React.useState<ExpenseDialogSubject | null>(null);
  const [busyKey, setBusyKey] = React.useState<string | null>(null);

  // A selection outside the visible period (after navigating) is dropped.
  const selected =
    selectedDay && inRange(selectedDay, data.range) ? selectedDay : null;
  const panelDay = data.view === 'day' ? data.date : selected;

  const navigate = (href: string) =>
    startTransition(() => router.push(href, { scroll: false }));
  const refresh = () => startTransition(() => router.refresh());

  const labels = React.useMemo<Partial<RecurringCalendarLabels>>(() => {
    const weekdays = weekdayNames(locale);
    return {
      views: {
        day: t('recurring.calendar.views.day'),
        week: t('recurring.calendar.views.week'),
        month: t('recurring.calendar.views.month'),
      },
      viewSwitcher: t('recurring.calendar.viewSwitcher'),
      today: t('recurring.calendar.today'),
      previous: t(`recurring.calendar.previous.${data.view}`),
      next: t(`recurring.calendar.next.${data.view}`),
      months: monthNames(locale),
      weekdays,
      weekdaysShort: weekdays.map((w) => w.slice(0, 3)),
      weekdaysNarrow: weekdays.map((w) => w.charAt(0).toUpperCase()),
      status: {
        upcoming: t('recurring.status.upcoming'),
        paid: t('recurring.status.paid'),
        skipped: t('recurring.status.skipped'),
        missed: t('recurring.status.overdue'),
        reminder: t('recurring.status.reminder'),
      },
      more: (count) => t('recurring.calendar.more', { count }),
      eventCount: (count) => t('recurring.calendar.eventCount', { count }),
      noEvents: t('recurring.calendar.noEvents'),
    };
  }, [t, locale, data.view]);

  const panelPayments = panelDay
    ? data.payments.filter((p) => p.day === panelDay)
    : data.payments;
  const panelCardDates = panelDay
    ? data.cardDates.filter((c) => c.day === panelDay)
    : data.cardDates;

  async function onPaymentAction(item: PaymentItem, action: PaymentAction) {
    if (!item.occurrenceId) return;
    setBusyKey(item.key);
    try {
      await runPaymentAction(action, item.occurrenceId, gql);
      toast.success(t(`recurring.toasts.${action}`, { name: item.name }));
      refresh();
    } catch (error) {
      toast.error(recurringErrorMessage(error, t));
    } finally {
      setBusyKey(null);
    }
  }

  function editExpense(id: string) {
    const item = data.expenses.find((e) => e.id === id);
    if (item) setDialog({ mode: 'edit', expense: item.expense });
  }

  function onSaved(changed: boolean, name: string) {
    setDialog(null);
    if (!changed) {
      toast(t('recurring.toasts.noChanges'));
      return;
    }
    toast.success(t('recurring.toasts.updated', { name }));
    refresh();
  }

  const panelTitle = panelDay
    ? t('recurring.panel.dayTitle', {
        date: longDate(panelDay, data.today, locale),
      })
    : t('recurring.panel.periodTitle', { period: data.periodLabel });

  return (
    <>
      <div
        aria-busy={pending}
        className={cn(
          'grid gap-6 transition-opacity',
          // A week needs the full width for its seven columns of payments.
          data.view !== 'week' &&
            '@3xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]',
          pending && 'opacity-60',
        )}
      >
        <RecurringCalendar
          className="min-w-0 self-start"
          view={data.view}
          date={data.date}
          selectedDate={data.view === 'day' ? data.date : selected}
          today={data.today}
          events={data.events}
          weekStartsOn={1}
          labels={labels}
          onViewChange={(view) =>
            navigate(calendarHref({ view, date: selected ?? data.date }))
          }
          onSelectDate={(day) => {
            if (data.view === 'day' || !inRange(day, data.range)) {
              navigate(calendarHref({ view: data.view, date: day }));
              return;
            }
            setSelectedDay((current) => (current === day ? null : day));
          }}
          onPrevious={() => navigate(data.prevHref)}
          onNext={() => navigate(data.nextHref)}
          onToday={() => navigate(data.todayHref)}
          onEventClick={(event) => setSelectedDay(event.date)}
        />

        <PaymentList
          title={panelTitle}
          payments={panelPayments}
          cardDates={panelCardDates}
          emptyText={
            panelDay
              ? t('recurring.panel.emptyDay')
              : t('recurring.panel.emptyPeriod')
          }
          busyKey={busyKey}
          cardDateLabel={
            panelDay ? undefined : (item) => shortDate(item.day, locale)
          }
          onAction={onPaymentAction}
          onEdit={(item) => editExpense(item.expenseId)}
          onShowPeriod={
            selected && data.view !== 'day'
              ? () => setSelectedDay(null)
              : undefined
          }
        />
      </div>

      {dialog ? (
        <ExpenseDialog
          subject={dialog}
          accounts={data.accounts}
          categories={data.categories}
          defaultCurrency={data.currency}
          onClose={() => setDialog(null)}
          onSaved={onSaved}
        />
      ) : null}
    </>
  );
}
