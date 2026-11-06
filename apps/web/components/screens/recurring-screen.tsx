'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarClock,
  CalendarDays,
  CircleCheck,
  Landmark,
  Plus,
  Repeat,
  Sparkles,
} from 'lucide-react';

import {
  RecurringCalendar,
  type RecurringCalendarLabels,
} from '@finnit/ui/components/finance/recurring-calendar';
import { Button } from '@finnit/ui/components/ui/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@finnit/ui/components/ui/tabs';
import { toast } from '@finnit/ui/components/ui/toaster';
import { cn } from '@finnit/ui/lib/utils';

import {
  ConfirmDialog,
  type ConfirmRequest,
} from '@/components/admin/confirm-dialog';
import { PageHeader } from '@/components/page-header';
import {
  ExpenseDialog,
  type ExpenseDialogSubject,
} from '@/components/recurring/expense-dialog';
import { LoanDialog } from '@/components/debts/loan-dialog';
import { ExpenseList } from '@/components/recurring/expense-list';
import { PaymentList } from '@/components/recurring/payment-list';
import { SuggestionsSection } from '@/components/recurring/suggestions-section';
import { SummaryCard } from '@/components/recurring/summary-card';
import { TabCount } from '@/components/recurring/tab-count';
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
import {
  parseTabParam,
  withTabParam,
  type RecurringTab,
} from '@/lib/recurring/tabs';
import type { ApiRecurringSuggestion } from '@/lib/recurring/types';
import { DEBTS_PATH } from '@/lib/debts/view';
import type {
  ExpenseItem,
  PaymentItem,
  RecurringScreenView,
} from '@/lib/recurring/view';

const TEAL = '#00696e';
const GREEN = '#00a86b';
const PURPLE = '#6c72cb';
const SUMMARY_CARD = 'w-[78%] shrink-0 snap-start sm:w-auto';
const TAB = 'flex-1 px-2 sm:flex-none sm:px-4';
const TAB_ICON = 'hidden sm:block';

/**
 * "Pagos recurrentes": totals, then one tab at a time: the period's calendar
 * and payments, every recurring expense, and suggestions detected from the
 * user's movements.
 */
export function RecurringScreen({
  data,
  initialTab,
}: {
  data: RecurringScreenView;
  initialTab: RecurringTab;
}) {
  const router = useRouter();
  const l = useLocalizer();
  const { t, locale } = l;
  const [pending, startTransition] = React.useTransition();
  const [selectedDay, setSelectedDay] = React.useState<string | null>(null);
  const [dialog, setDialog] = React.useState<ExpenseDialogSubject | null>(null);
  // A suggestion being saved as a loan.
  const [loanFor, setLoanFor] = React.useState<ApiRecurringSuggestion | null>(
    null,
  );
  const [confirm, setConfirm] = React.useState<ConfirmRequest | null>(null);
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const suggestions = useRecurringSuggestions(useSessionUser().id);
  const [tab, setTab] = React.useState(initialTab);

  // The tab lives in the URL (no navigation) so a reload or refresh keeps it.
  function changeTab(value: string) {
    const next = parseTabParam(value);
    setTab(next);
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${withTabParam(window.location.search, next)}`,
    );
  }

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

  function onLoanSaved(id: string, name: string) {
    const suggestion = loanFor;
    setLoanFor(null);
    if (suggestion) suggestions.remove(suggestion.fingerprint);
    toast.success(t('recurring.toasts.acceptedAsLoan', { name }));
    router.push(`${DEBTS_PATH}/${id}`);
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
      <PageHeader
        title={t('recurring.title')}
        subtitle={t('recurring.subtitle')}
        actions={
          <Button
            type="button"
            variant="secondary"
            onClick={() => setDialog({ mode: 'create' })}
          >
            <Plus aria-hidden /> {t('recurring.new')}
          </Button>
        }
      />

      {/* On phones the totals scroll sideways, so the tabs stay near the top. */}
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
        <SummaryCard
          className={SUMMARY_CARD}
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
          className={SUMMARY_CARD}
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
          className={SUMMARY_CARD}
          icon={Landmark}
          accent={PURPLE}
          label={t('recurring.summary.fixedMonthly')}
          amount={data.totals.fixedMonthly}
          detail={t('recurring.summary.fixedMonthlyDetail', {
            count: data.totals.activeCount,
          })}
        />
      </div>

      <Tabs value={tab} onValueChange={changeTab} className="gap-5">
        <TabsList
          aria-label={t('recurring.tabs.label')}
          className="w-full sm:w-fit"
        >
          <TabsTrigger value="calendar" className={TAB}>
            <CalendarDays aria-hidden className={TAB_ICON} />{' '}
            {t('recurring.tabs.calendar')}
          </TabsTrigger>
          <TabsTrigger value="list" className={TAB}>
            <Repeat aria-hidden className={TAB_ICON} />{' '}
            {t('recurring.tabs.list')}
            <TabCount count={data.expenses.length} />
          </TabsTrigger>
          <TabsTrigger value="suggestions" className={TAB}>
            <Sparkles aria-hidden className={TAB_ICON} />{' '}
            {t('recurring.tabs.suggestions')}
            {suggestions.state.status === 'ready' ? (
              <TabCount count={suggestions.state.items.length} highlight />
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar">
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
        </TabsContent>

        <TabsContent value="list">
          <ExpenseList
            expenses={data.expenses}
            busyId={busyKey}
            onCreate={() => setDialog({ mode: 'create' })}
            onEdit={(item) => editExpense(item.id)}
            onToggleActive={toggleActive}
            onDelete={askDelete}
          />
        </TabsContent>

        <TabsContent value="suggestions">
          <SuggestionsSection
            state={suggestions.state}
            today={data.today}
            onRetry={() => void suggestions.reload()}
            onAdd={(suggestion) =>
              setDialog({ mode: 'suggestion', suggestion })
            }
            onLoan={setLoanFor}
            onDismiss={dismiss}
          />
        </TabsContent>
      </Tabs>

      {dialog ? (
        <ExpenseDialog
          subject={dialog}
          accounts={data.accounts}
          categories={data.categories}
          defaultCurrency={data.currency}
          onClose={() => setDialog(null)}
          onSaved={onSaved}
          onSwitchToLoan={
            dialog.mode === 'suggestion'
              ? () => {
                  setLoanFor(dialog.suggestion);
                  setDialog(null);
                }
              : undefined
          }
        />
      ) : null}
      {loanFor ? (
        <LoanDialog
          fingerprint={loanFor.fingerprint}
          accounts={data.accounts}
          categories={data.categories}
          today={data.today}
          onClose={() => setLoanFor(null)}
          onSaved={onLoanSaved}
        />
      ) : null}
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
