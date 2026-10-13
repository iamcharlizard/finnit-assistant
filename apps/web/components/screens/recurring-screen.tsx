'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock, CircleCheck, Landmark, Plus } from 'lucide-react';

import {
  RecurringCalendar,
  type RecurringCalendarLabels,
} from '@finnit/ui/components/finance/recurring-calendar';
import { Button } from '@finnit/ui/components/ui/button';
import { toast } from '@finnit/ui/components/ui/toaster';
import { cn } from '@finnit/ui/lib/utils';

import {
  ConfirmDialog,
  type ConfirmRequest,
} from '@/components/admin/confirm-dialog';
import {
  ExpenseDialog,
  type ExpenseDialogSubject,
} from '@/components/recurring/expense-dialog';
import { ExpenseList } from '@/components/recurring/expense-list';
import { PaymentList } from '@/components/recurring/payment-list';
import { SuggestionsSection } from '@/components/recurring/suggestions-section';
import { SummaryCard } from '@/components/recurring/summary-card';
import { useSessionUser } from '@/components/session-provider';
import { useRecurringSuggestions } from '@/hooks/use-recurring-suggestions';
import {
  longDate,
  monthNames,
  shortDate,
  weekdayNames,
} from '@/lib/finance/dates';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import {
  deleteRecurring,
  dismissSuggestion,
  recurringErrorMessage,
  runPaymentAction,
  setRecurringActive,
  type PaymentAction,
} from '@/lib/recurring/api';
import { inRange, recurringHref } from '@/lib/recurring/range';
import type { ApiRecurringSuggestion } from '@/lib/recurring/types';
import type {
  ExpenseItem,
  PaymentItem,
  RecurringScreenView,
} from '@/lib/recurring/view';

const TEAL = '#00696e';
const GREEN = '#00a86b';
const PURPLE = '#6c72cb';

/**
 * "Pagos recurrentes": the period's calendar and payments, suggestions
 * detected from the user's movements, and every recurring expense.
 */
export function RecurringScreen({ data }: { data: RecurringScreenView }) {
  const router = useRouter();
  const l = useLocalizer();
  const { t, locale } = l;
  const [pending, startTransition] = React.useTransition();
  const [selectedDay, setSelectedDay] = React.useState<string | null>(null);
  const [dialog, setDialog] = React.useState<ExpenseDialogSubject | null>(null);
  const [confirm, setConfirm] = React.useState<ConfirmRequest | null>(null);
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const suggestions = useRecurringSuggestions(useSessionUser().id);

  // A selection outside the visible period (after navigating) is dropped.
  const selected =
    selectedDay && inRange(selectedDay, data.range) ? selectedDay : null;
  const panelDay = data.view === 'day' ? data.date : selected;

  const navigate = (href: string) =>
    startTransition(() => router.push(href, { scroll: false }));
  const refresh = () => startTransition(() => router.refresh());
  const fail = (error: unknown) => toast.error(recurringErrorMessage(error, t));

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
      fail(error);
    } finally {
      setBusyKey(null);
    }
  }

  function editExpense(id: string) {
    const item = data.expenses.find((e) => e.id === id);
    if (item) setDialog({ mode: 'edit', expense: item.expense });
  }

  async function toggleActive(item: ExpenseItem) {
    setBusyKey(item.id);
    try {
      await setRecurringActive(item.id, !item.active, gql);
      toast.success(
        t(
          item.active ? 'recurring.toasts.paused' : 'recurring.toasts.resumed',
          {
            name: item.name,
          },
        ),
      );
      refresh();
    } catch (error) {
      fail(error);
    } finally {
      setBusyKey(null);
    }
  }

  function askDelete(item: ExpenseItem) {
    setConfirm({
      title: t('recurring.delete.title', { name: item.name }),
      description: t('recurring.delete.description'),
      confirmLabel: t('recurring.delete.confirm'),
      destructive: true,
      onConfirm: async () => {
        setConfirm(null);
        setBusyKey(item.id);
        try {
          await deleteRecurring(item.id, gql);
          toast.success(t('recurring.toasts.deleted', { name: item.name }));
          refresh();
        } catch (error) {
          fail(error);
        } finally {
          setBusyKey(null);
        }
      },
    });
  }

  async function dismiss(suggestion: ApiRecurringSuggestion, index: number) {
    // Off the list right away; back in place if the API refuses.
    suggestions.remove(suggestion.fingerprint);
    try {
      await dismissSuggestion(suggestion.fingerprint, gql);
      toast.success(
        t('recurring.toasts.dismissed', { name: suggestion.suggestedName }),
      );
    } catch (error) {
      suggestions.restore(suggestion, index);
      fail(error);
    }
  }

  function onSaved(changed: boolean, name: string) {
    const subject = dialog;
    setDialog(null);
    if (!changed) {
      toast(t('recurring.toasts.noChanges'));
      return;
    }
    if (subject?.mode === 'suggestion') {
      suggestions.remove(subject.suggestion.fingerprint);
      toast.success(t('recurring.toasts.accepted', { name }));
    } else {
      toast.success(
        t(
          subject?.mode === 'edit'
            ? 'recurring.toasts.updated'
            : 'recurring.toasts.created',
          { name },
        ),
      );
    }
    refresh();
  }

  const panelTitle = panelDay
    ? t('recurring.panel.dayTitle', {
        date: longDate(panelDay, data.today, locale),
      })
    : t('recurring.panel.periodTitle', { period: data.periodLabel });

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div className="flex flex-col gap-1">
          <h1 className="text-[28px] leading-9 font-bold text-brand-ink sm:text-[32px] sm:leading-10">
            {t('recurring.title')}
          </h1>
          <p className="text-[15px] text-on-surface-variant">
            {t('recurring.subtitle')}
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setDialog({ mode: 'create' })}
        >
          <Plus aria-hidden /> {t('recurring.new')}
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          icon={CalendarClock}
          accent={TEAL}
          label={t('recurring.summary.toPay')}
          amount={data.totals.toPay}
          detail={t('recurring.summary.toPayDetail', {
            count: data.totals.toPayCount,
            period: data.periodLabel,
          })}
        />
        <SummaryCard
          icon={CircleCheck}
          accent={GREEN}
          label={t('recurring.summary.paid')}
          amount={data.totals.paid}
          detail={t('recurring.summary.paidDetail', {
            count: data.totals.paidCount,
            period: data.periodLabel,
          })}
        />
        <SummaryCard
          icon={Landmark}
          accent={PURPLE}
          label={t('recurring.summary.fixedMonthly')}
          amount={data.totals.fixedMonthly}
          detail={t('recurring.summary.fixedMonthlyDetail', {
            count: data.totals.activeCount,
          })}
        />
      </div>

      <div
        aria-busy={pending}
        className={cn(
          'grid gap-6 transition-opacity',
          // A week needs the full width for its seven columns of payments.
          data.view !== 'week' && 'lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]',
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
            navigate(recurringHref({ view, date: selected ?? data.date }))
          }
          onSelectDate={(day) => {
            if (data.view === 'day' || !inRange(day, data.range)) {
              navigate(recurringHref({ view: data.view, date: day }));
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

      <SuggestionsSection
        state={suggestions.state}
        today={data.today}
        onRetry={() => void suggestions.reload()}
        onAdd={(suggestion) => setDialog({ mode: 'suggestion', suggestion })}
        onDismiss={dismiss}
      />

      <ExpenseList
        expenses={data.expenses}
        busyId={busyKey}
        onCreate={() => setDialog({ mode: 'create' })}
        onEdit={(item) => editExpense(item.id)}
        onToggleActive={toggleActive}
        onDelete={askDelete}
      />

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
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
