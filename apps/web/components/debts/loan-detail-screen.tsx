'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Banknote, Plus, Trash2 } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@finnit/ui/components/ui/tabs';
import { InfoHint } from '@finnit/ui/components/ui/info-hint';
import { toast } from '@finnit/ui/components/ui/toaster';
import { cn } from '@finnit/ui/lib/utils';

import {
  ConfirmDialog,
  type ConfirmRequest,
} from '@/components/admin/confirm-dialog';
import { PageHeader } from '@/components/page-header';
import {
  confirmLoanPayment,
  debtErrorMessage,
  deleteDebtCharge,
  deleteHistoricalPayment,
  loadLoanCandidates,
} from '@finnit/core/debts/api';
import {
  buildCandidateRows,
  type CandidateRow,
  type ScheduleRow,
} from '@finnit/core/debts/detail-view';
import type { LoanDetailData } from '@/lib/debts/load';
import { isCardInstallments } from '@finnit/core/debts/types';
import { DEBTS_PATH, LOANS_PATH } from '@finnit/core/debts/view';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import { ChargeDialog } from './charge-dialog';
import { LoanAmortizationTable } from './loan-amortization-table';
import { LoanCandidates, type CandidatesState } from './loan-candidates';
import { LoanDetailsTab } from './loan-details-tab';
import { LoanLentTable } from './loan-lent-table';
import { LoanPaymentsTable } from './loan-payments-table';
import { LoanProgress } from './loan-progress';
import { LinkExpenseDialog } from '@/components/loan-links/link-expense-dialog';
import { UnlinkLoanDialog } from '@/components/loan-links/unlink-loan-dialog';
import { useTransactionDrawer } from '@/components/transaction-detail/transaction-drawer';
import { PaymentDialog } from './payment-dialog';
import { RescheduleDialog } from './reschedule-dialog';
import { InstallmentEditDialog } from './installment-edit-dialog';

/**
 * One loan: what is left on top, then tabs: its details (editable), the
 * amortization table (paid, open and projected payments; not for personal
 * loans), each amount lent (personal loans and purchase financing,
 * editable), and the payments: scheduled ones for personal loans bought in
 * installments, the bank movements that look like its payments and those
 * already made.
 */
export function LoanDetailScreen({ data }: { data: LoanDetailData }) {
  const { view, accounts, categories, today } = data;
  const debt = view.debt;
  const router = useRouter();
  const l = useLocalizer();
  const { t } = l;
  const td = useTranslations('debts.detail');
  const [pending, startTransition] = React.useTransition();
  const [paying, setPaying] = React.useState<{ row?: ScheduleRow } | null>(
    null,
  );
  // A new amount (true) or the id of the one being edited.
  const [adding, setAdding] = React.useState<boolean | string>(false);
  const [tab, setTab] = React.useState('details');
  const personal = debt.loanType === 'personal';
  // A card purchase in installments: the card bills it, no charges.
  const cardPurchase = isCardInstallments(debt);
  // Personal loans and purchase financing list each amount in its own tab.
  const lentTab = personal || debt.loanType === 'purchase_financing';
  const [moving, setMoving] = React.useState<ScheduleRow | null>(null);
  const [editingRow, setEditingRow] = React.useState<ScheduleRow | null>(null);
  const [linkingRow, setLinkingRow] = React.useState<ScheduleRow | null>(null);
  const [unlinkingRow, setUnlinkingRow] = React.useState<ScheduleRow | null>(
    null,
  );
  const drawer = useTransactionDrawer();
  const tl = useTranslations('debts.links');
  const [confirm, setConfirm] = React.useState<ConfirmRequest | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [candidates, setCandidates] = React.useState<CandidatesState>({
    status: 'loading',
  });

  const refresh = () => startTransition(() => router.refresh());

  const hasSchedule = Boolean(debt.recurringExpenseId);
  const editingCharge =
    typeof adding === 'string'
      ? debt.charges.find((charge) => charge.id === adding)
      : undefined;

  // Candidates may take a moment (the AI settles ties), so they load after paint.
  const loadCandidates = React.useCallback(() => {
    if (!hasSchedule || view.paidOff) {
      setCandidates({ status: 'ready', rows: [] });
      return;
    }
    setCandidates({ status: 'loading' });
    loadLoanCandidates(debt.id, gql)
      .then((found) =>
        setCandidates({
          status: 'ready',
          rows: buildCandidateRows(found, today, l),
        }),
      )
      .catch(() => setCandidates({ status: 'error' }));
  }, [debt.id, hasSchedule, view.paidOff, today, l]);

  // Reloaded after every change to the loan's payments.
  const stamp = `${debt.totalPaid}:${debt.remainingBalance}`;
  React.useEffect(() => {
    loadCandidates();
  }, [loadCandidates, stamp]);

  async function confirmCandidate(row: CandidateRow) {
    setBusy(row.key);
    try {
      await confirmLoanPayment(row.candidate, gql);
      toast.success(td('candidateConfirmed'));
      refresh();
    } catch (error) {
      toast.error(debtErrorMessage(error, t));
    } finally {
      setBusy(null);
    }
  }

  function openMovement(transactionId: string) {
    drawer.open(transactionId, { onChange: refresh });
  }

  function askDeleteCharge(id: string) {
    setConfirm({
      title: td('deleteChargeTitle'),
      description: td('deleteChargeDescription'),
      confirmLabel: td('deleteConfirm'),
      destructive: true,
      onConfirm: async () => {
        setConfirm(null);
        setBusy(id);
        try {
          await deleteDebtCharge(id, gql);
          toast.success(td('chargeDeleted'));
          refresh();
        } catch (error) {
          toast.error(debtErrorMessage(error, t));
        } finally {
          setBusy(null);
        }
      },
    });
  }

  function askDeletePayment(id: string) {
    setConfirm({
      title: td('deletePaymentTitle'),
      description: td('deletePaymentDescription'),
      confirmLabel: td('deleteConfirm'),
      destructive: true,
      onConfirm: async () => {
        setConfirm(null);
        setBusy(id);
        try {
          await deleteHistoricalPayment(id, gql);
          toast.success(td('paymentDeleted'));
          refresh();
        } catch (error) {
          toast.error(debtErrorMessage(error, t));
        } finally {
          setBusy(null);
        }
      },
    });
  }

  const subtitle = [
    view.lenderName,
    debt.loanType
      ? t(`debts.loanTypes.${debt.loanType}`)
      : t(`debts.kinds.${debt.kind}`),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={view.name}
        subtitle={subtitle}
        back={
          debt.kind === 'loan' && !cardPurchase
            ? { href: LOANS_PATH, label: td('backLoans') }
            : { href: `${DEBTS_PATH}?tab=other`, label: td('back') }
        }
        actions={
          <div className="flex gap-2">
            {debt.kind === 'loan' && !cardPurchase ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setAdding(true)}
              >
                <Plus aria-hidden />{' '}
                {debt.loanType === 'purchase_financing'
                  ? td('addPurchase')
                  : td('addCharge')}
              </Button>
            ) : null}
            {view.paidOff || cardPurchase ? null : (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPaying({})}
              >
                <Banknote aria-hidden /> {t('debts.card.pay')}
              </Button>
            )}
          </div>
        }
      />

      <div
        aria-busy={pending}
        className={cn(
          'flex flex-col gap-6 transition-opacity',
          pending && 'opacity-60',
        )}
      >
        <LoanProgress
          share={view.paidShare}
          outstanding={view.outstanding}
          historicalPaid={view.historicalPaid}
          lender={view.lenderName}
          next={
            view.paidOff
              ? t('debts.card.paidOff')
              : view.next
                ? td(view.next.overdue ? 'nextOverdue' : 'next', {
                    date: view.next.dateLabel,
                    amount: view.next.amountLabel,
                  })
                : td('noNext')
          }
        />

        {cardPurchase ? (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-card bg-track/60 p-3 text-sm text-on-background">
            <span>
              {debt.purchaseTransactionId
                ? td('cardPurchase.linked')
                : td('cardPurchase.unlinked')}
            </span>
            {debt.purchaseTransactionId ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => openMovement(debt.purchaseTransactionId!)}
              >
                {td('cardPurchase.open')}
              </Button>
            ) : null}
          </p>
        ) : null}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="self-start">
            <TabsTrigger value="details">{td('tabs.details')}</TabsTrigger>
            {personal ? null : (
              <TabsTrigger value="amortization">
                {td('tabs.amortization')}
              </TabsTrigger>
            )}
            {lentTab ? (
              <TabsTrigger value="lent">
                {td(personal ? 'tabs.lentPersonal' : 'tabs.lentPurchase')} (
                {view.lent.length})
              </TabsTrigger>
            ) : null}
            <TabsTrigger value="payments">
              {td('tabs.payments')}
              {view.payments.length > 0 ? ` (${view.payments.length})` : ''}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="flex flex-col gap-6">
            {debt.kind === 'loan' ? (
              <LoanDetailsTab
                debt={debt}
                facts={view.facts}
                categories={categories}
                today={today}
                onSaved={refresh}
              />
            ) : null}
            {!lentTab && view.charges.length > 0 ? (
              <section
                aria-labelledby="loan-charges"
                className="flex flex-col gap-3"
              >
                <h2
                  id="loan-charges"
                  className="px-1 text-lg font-bold text-on-background"
                >
                  {td('chargesTitle')}
                </h2>
                <ul className="divide-y divide-outline rounded-card border border-outline bg-surface">
                  {view.charges.map((charge) => (
                    <li
                      key={charge.id}
                      className="flex flex-wrap items-center gap-3 px-4 py-3"
                    >
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-sm font-medium text-on-background">
                          {charge.description ?? td('chargeUntitled')}
                        </span>
                        <span className="text-xs text-on-surface-variant">
                          {[
                            charge.dateLabel,
                            t(`debts.destinations.${charge.destination}`),
                            charge.purpose,
                            charge.installments
                              ? td('chargeInstallments', {
                                  count: charge.installments,
                                })
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </span>
                      <span className="text-right text-sm tabular-nums">
                        <span className="block font-medium text-on-background">
                          {charge.total}
                        </span>
                        {charge.total !== charge.principal ? (
                          <span className="block text-xs text-on-surface-variant">
                            {td('chargePrincipal', {
                              amount: charge.principal,
                            })}
                          </span>
                        ) : null}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={busy === charge.id}
                        aria-label={td('deleteCharge')}
                        onClick={() => askDeleteCharge(charge.id)}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </TabsContent>

          {lentTab ? (
            <TabsContent value="lent" className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-1 px-1 text-lg font-bold text-on-background">
                  {td(personal ? 'lent.titlePersonal' : 'lent.titlePurchase')}
                  {personal ? (
                    <InfoHint label={td('lent.titlePersonal')}>
                      {td('lent.hintPersonal')}
                    </InfoHint>
                  ) : null}
                </h2>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAdding(true)}
                >
                  <Plus aria-hidden />{' '}
                  {td(personal ? 'lent.addPersonal' : 'lent.addPurchase')}
                </Button>
              </div>
              <LoanLentTable
                rows={view.lent}
                busy={busy}
                onEdit={setAdding}
                onDelete={askDeleteCharge}
              />
            </TabsContent>
          ) : null}

          {personal ? null : (
            <TabsContent value="amortization">
              <LoanAmortizationTable
                rows={view.schedule}
                hasBreakdown={view.hasBreakdown}
                hasFees={view.hasFees}
                onPay={(row) => setPaying({ row })}
                onReschedule={setMoving}
                onLinkExpense={setLinkingRow}
                onUnlink={setUnlinkingRow}
                onOpenMovement={openMovement}
                onEditInstallment={cardPurchase ? setEditingRow : undefined}
              />
            </TabsContent>
          )}

          <TabsContent value="payments" className="flex flex-col gap-6">
            {personal && view.schedule.length > 0 ? (
              <section
                aria-labelledby="loan-scheduled"
                className="flex flex-col gap-3"
              >
                <h2
                  id="loan-scheduled"
                  className="flex items-center gap-1 px-1 text-lg font-bold text-on-background"
                >
                  {td('scheduledTitle')}
                  <InfoHint label={td('scheduledTitle')}>
                    {td('scheduledHint')}
                  </InfoHint>
                </h2>
                <LoanAmortizationTable
                  rows={view.schedule}
                  hasBreakdown={false}
                  hasFees={false}
                  onPay={(row) => setPaying({ row })}
                  onReschedule={setMoving}
                  onLinkExpense={setLinkingRow}
                  onUnlink={setUnlinkingRow}
                  onOpenMovement={openMovement}
                />
              </section>
            ) : null}

            {hasSchedule && !view.paidOff ? (
              <LoanCandidates
                state={candidates}
                busy={busy}
                onRetry={loadCandidates}
                onConfirm={confirmCandidate}
              />
            ) : null}

            <section
              aria-labelledby="loan-payments"
              className="flex flex-col gap-3"
            >
              <h2
                id="loan-payments"
                className="px-1 text-lg font-bold text-on-background"
              >
                {td('paymentsTitle')}
              </h2>
              {view.payments.length === 0 ? (
                <p className="px-1 text-sm text-on-surface-variant">
                  {td('paymentsEmpty')}
                </p>
              ) : (
                <LoanPaymentsTable
                  rows={view.payments}
                  busy={busy}
                  onDelete={askDeletePayment}
                />
              )}
              <p className="px-1 text-xs text-on-surface-variant">
                {td('paymentsHint')}
              </p>
            </section>
          </TabsContent>
        </Tabs>
      </div>

      {paying ? (
        <PaymentDialog
          debt={debt}
          remainingLabel={view.remaining}
          installment={
            paying.row?.occurrenceId
              ? {
                  occurrenceId: paying.row.occurrenceId,
                  amount: paying.row.amount,
                  dateLabel: paying.row.dateLabel,
                  amountLabel: paying.row.amountLabel,
                }
              : undefined
          }
          accounts={accounts}
          categories={categories}
          today={today}
          onClose={() => setPaying(null)}
          onSaved={() => {
            setPaying(null);
            toast.success(t('debts.toasts.paid', { name: view.name }));
            refresh();
          }}
        />
      ) : null}
      {adding ? (
        <ChargeDialog
          debt={debt}
          charge={editingCharge}
          accounts={accounts}
          categories={categories}
          today={today}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            toast.success(td(editingCharge ? 'chargeUpdated' : 'chargeAdded'));
            refresh();
          }}
        />
      ) : null}
      {linkingRow?.linkOccurrenceId ? (
        <LinkExpenseDialog
          occurrenceId={linkingRow.linkOccurrenceId}
          dateLabel={linkingRow.dateLabel}
          amountLabel={linkingRow.amountLabel}
          today={today}
          onClose={() => setLinkingRow(null)}
          onLinked={() => {
            setLinkingRow(null);
            toast.success(tl('expense.done'));
            refresh();
          }}
        />
      ) : null}
      {unlinkingRow?.unlinkOccurrenceId ? (
        <UnlinkLoanDialog
          occurrenceId={unlinkingRow.unlinkOccurrenceId}
          onClose={() => setUnlinkingRow(null)}
          onUnlinked={() => {
            setUnlinkingRow(null);
            toast.success(tl('unlink.done'));
            refresh();
          }}
        />
      ) : null}
      {moving?.occurrenceId ? (
        <RescheduleDialog
          row={{ ...moving, occurrenceId: moving.occurrenceId }}
          onClose={() => setMoving(null)}
          onSaved={() => {
            setMoving(null);
            toast.success(td('rescheduled'));
            refresh();
          }}
        />
      ) : null}
      {editingRow?.editOccurrenceId ? (
        <InstallmentEditDialog
          row={{ ...editingRow, editOccurrenceId: editingRow.editOccurrenceId }}
          total={debt.installmentsTotal ?? view.schedule.length}
          onClose={() => setEditingRow(null)}
          onSaved={() => {
            setEditingRow(null);
            toast.success(td('editInstallment.saved'));
            refresh();
          }}
        />
      ) : null}
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
