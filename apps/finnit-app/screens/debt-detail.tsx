import * as React from 'react';
import { Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslations } from 'use-intl';

import { CalendarClock, HandCoins, Link2, Pencil, Plus, Receipt, Trash2, Unlink } from 'lucide-react-native';

import { pendingPayments } from '@finnit/core/debts/allocation';
import { debtErrorMessage, deleteDebtCharge, deleteHistoricalPayment } from '@finnit/core/debts/api';
import { buildLoanDetailView, type ScheduleRow, type ScheduleRowStatus } from '@finnit/core/debts/detail-view';
import { cardTermsOf } from '@finnit/core/debts/card-installments';
import { DEBT_DETAIL_QUERY, type DebtDetailResult } from '@finnit/core/debts/request';
import { isCardInstallments, isLoanContainer, type ApiDebtCharge } from '@finnit/core/debts/types';
import { todayKey } from '@finnit/core/finance/dates';
import { cn } from '@finnit/ui-native/lib/utils';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Badge, type BadgeVariant } from '@finnit/ui-native/components/ui/badge';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Card } from '@finnit/ui-native/components/ui/card';
import { InfoHint } from '@finnit/ui-native/components/ui/info-hint';
import { Progress } from '@finnit/ui-native/components/ui/progress';
import { Segmented } from '@finnit/ui-native/components/ui/segmented';
import { Text } from '@finnit/ui-native/components/ui/text';
import { toast } from '@finnit/ui-native/components/ui/toaster';

import { ChargeSheet } from '@/components/debts/charge-sheet';
import { InstallmentEditSheet } from '@/components/debts/installment-edit-sheet';
import { LoanEditSheet } from '@/components/debts/loan-edit-sheet';
import { PaymentSheet } from '@/components/debts/payment-sheet';
import { RescheduleSheet } from '@/components/debts/reschedule-sheet';
import { LinkExpenseSheet } from '@/components/loan-links/link-expense-sheet';
import { UnlinkLoanSheet } from '@/components/loan-links/unlink-loan-sheet';
import { Screen } from '@/components/shell/screen';
import { useGql } from '@/lib/graphql/runner';
import { useLocalizer } from '@/lib/i18n/i18n-provider';
import { useView } from '@/lib/graphql/use-view';
import { emitTransactionsChanged, useOnTransactionsChanged } from '@/lib/transactions/events';

const STATUS_VARIANT: Record<ScheduleRowStatus, BadgeVariant> = {
  paid: 'income',
  historical: 'muted',
  upcoming: 'outline',
  overdue: 'expense',
  skipped: 'muted',
  projected: 'outline',
};

type Tab = 'details' | 'amortization' | 'lent' | 'payments';

/**
 * One debt (the web's /planning/debts/[id]): what's left on top, then tabs
 * like the web: its details (editable), the amortization table (not for
 * personal loans), each purchase or amount (purchase financing and
 * personal loans: add, edit, remove) and the payments (the scheduled ones
 * first for personal loans). "Registrar pago" pays it, choosing which
 * pending payments a payment covers on purchase financing and personal
 * loans.
 */
export function DebtDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTranslations('debts.detail');
  const tl = useTranslations('debts.links');
  const l = useLocalizer();
  const gql = useGql();
  const router = useRouter();
  const [tab, setTab] = React.useState<Tab>('details');
  const [linking, setLinking] = React.useState<ScheduleRow | null>(null);
  const [unlinking, setUnlinking] = React.useState<ScheduleRow | null>(null);
  const [editingInstallment, setEditingInstallment] = React.useState<ScheduleRow | null>(null);
  const [rescheduling, setRescheduling] = React.useState<ScheduleRow | null>(null);
  const [paying, setPaying] = React.useState<{ row?: ScheduleRow } | null>(null);
  const [charge, setCharge] = React.useState<{ charge?: ApiDebtCharge } | null>(null);
  const [editingLoan, setEditingLoan] = React.useState(false);
  const today = todayKey();
  const { view, loading, error, refreshing, refresh } = useView({
    query: DEBT_DETAIL_QUERY,
    variables: { id, debtId: id },
    build: (data: DebtDetailResult, loc) => ({
      ...buildLoanDetailView(data.debt, data.loanSchedule, { today, categories: data.categories }, loc),
      // A card purchase in installments: its installments are picked by cut-off.
      cardTerms: cardTermsOf(data.accounts.edges.find((e) => e.node.id === data.debt.linkedAccountId)?.node),
      accounts: data.accounts.edges.map((e) => e.node),
      categories: data.categories,
    }),
  });
  useOnTransactionsChanged(refresh);

  // Reloads this screen too (it listens) and the lists that show movements.
  const changed = (message: string) => {
    toast.success(message);
    emitTransactionsChanged(null);
  };

  const debt = view?.debt;
  const personal = debt?.loanType === 'personal';
  const cardPurchase = debt ? isCardInstallments(debt) : false;
  const container = debt ? isLoanContainer(debt) : false;
  const isLoan = debt?.kind === 'loan';
  const purchase = debt?.loanType === 'purchase_financing';

  const tabs: { value: Tab; label: string }[] = view
    ? [
        { value: 'details', label: t('tabsShort.details') },
        ...(personal ? [] : [{ value: 'amortization' as const, label: t('tabsShort.amortization') }]),
        ...(container ? [{ value: 'lent' as const, label: `${t(personal ? 'tabsShort.lentPersonal' : 'tabsShort.lentPurchase')} (${view.lent.length})` }] : []),
        { value: 'payments', label: `${t('tabsShort.payments')} (${view.payments.length})` },
      ]
    : [];
  const shown: Tab = tabs.some((option) => option.value === tab) ? tab : 'details';

  function askDeleteCharge(chargeId: string) {
    Alert.alert(t('deleteChargeTitle'), t('deleteChargeDescription'), [
      { text: l.t('common.cancel'), style: 'cancel' },
      {
        text: t('deleteConfirm'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDebtCharge(chargeId, gql);
            changed(t('chargeDeleted'));
          } catch (e) {
            toast.error(debtErrorMessage(e, l.t));
          }
        },
      },
    ]);
  }

  function askDeletePayment(paymentId: string) {
    Alert.alert(t('deletePaymentTitle'), t('deletePaymentDescription'), [
      { text: l.t('common.cancel'), style: 'cancel' },
      {
        text: t('deleteConfirm'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteHistoricalPayment(paymentId, gql);
            changed(t('paymentDeleted'));
          } catch (e) {
            toast.error(debtErrorMessage(e, l.t));
          }
        },
      },
    ]);
  }

  const scheduleRows = (rows: ScheduleRow[]) =>
    rows.length === 0 ? (
      <Text className="text-sm text-on-surface-variant">{t('scheduleEmpty')}</Text>
    ) : (
      rows.map((row, index) => (
        <ScheduleItem
          key={row.key}
          row={row}
          first={index === 0}
          statusLabel={t(`${cardPurchase ? 'cardStatus' : 'status'}.${row.status}`)}
          onPay={row.occurrenceId && !cardPurchase ? () => setPaying({ row }) : undefined}
          onReschedule={row.occurrenceId && !cardPurchase ? () => setRescheduling(row) : undefined}
          onEdit={row.editOccurrenceId ? () => setEditingInstallment(row) : undefined}
          onLink={row.linkOccurrenceId ? () => setLinking(row) : undefined}
          onOpenMovement={
            row.unlinkOccurrenceId && row.transactionId ? () => router.push({ pathname: '/transaction/[id]', params: { id: row.transactionId! } }) : undefined
          }
          onUnlink={row.unlinkOccurrenceId && row.transactionId ? () => setUnlinking(row) : undefined}
        />
      ))
    );

  return (
    <Screen
      title={view?.name ?? t('back')}
      back
      withBottomNav={false}
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={refresh}
      actions={
        view && isLoan && !cardPurchase ? (
          <>
            {!view.paidOff ? <Button size="sm" icon={HandCoins} label={l.t('debts.card.pay')} onPress={() => setPaying({})} /> : null}
            {container ? <Button size="sm" variant="outline" icon={Plus} label={t(purchase ? 'addPurchase' : 'addCharge')} onPress={() => setCharge({})} /> : null}
          </>
        ) : undefined
      }
    >
      {view && debt ? (
        <TwView className="gap-4">
          <Card className="gap-3">
            <Text className="text-xs text-on-surface-variant">{t('remaining')}</Text>
            <Text weight="bold" className="text-3xl" style={{ fontVariant: ['tabular-nums'] }}>
              {view.remaining}
            </Text>
            <Progress value={view.paidPercent} indicatorColor="var(--income)" accessibilityLabel={t('progress', { percent: view.paidPercent })} />
            <Text className="text-xs text-on-surface-variant">{t('progress', { percent: view.paidPercent })}</Text>
            <Text weight="medium" className={cn('text-sm', view.next?.overdue ? 'text-expense' : 'text-on-background')}>
              {view.next ? t(view.next.overdue ? 'nextOverdue' : 'next', { date: view.next.dateLabel, amount: view.next.amountLabel }) : t('noNext')}
            </Text>
            <TwView className="flex-row gap-3 border-t border-outline pt-3">
              <TwView className="flex-1">
                <Text className="text-xs text-on-surface-variant">{t('totalOwed')}</Text>
                <Text weight="bold" className="text-sm">
                  {view.totalOwed}
                </Text>
                <Text className="text-xs text-on-surface-variant">{view.interest ? t('interest', { amount: view.interest }) : t('noInterest')}</Text>
              </TwView>
              <TwView className="flex-1">
                <Text className="text-xs text-on-surface-variant">{t('paid')}</Text>
                <Text weight="bold" className="text-sm">
                  {view.paid}
                </Text>
                {view.historicalPaid ? <Text className="text-xs text-on-surface-variant">{t('historicalPaid', { amount: view.historicalPaid })}</Text> : null}
              </TwView>
            </TwView>
          </Card>

          <Segmented options={tabs} value={shown} onValueChange={setTab} accessibilityLabel={view.name} />

          {shown === 'details' ? (
            <TwView className="gap-4">
              {cardPurchase ? (
                <Card className="gap-2">
                  <Text className="text-sm">{debt.purchaseTransactionId ? t('cardPurchase.linked') : t('cardPurchase.unlinked')}</Text>
                  {debt.purchaseTransactionId ? (
                    <Button
                      size="sm"
                      variant="outline"
                      icon={Receipt}
                      label={t('cardPurchase.open')}
                      onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: debt.purchaseTransactionId! } })}
                    />
                  ) : null}
                </Card>
              ) : null}
              <Card className="gap-1">
                <TwView className="flex-row items-center justify-between gap-3 pb-1">
                  <Text accessibilityRole="header" weight="bold" className="text-base">
                    {t('detailsTitle')}
                  </Text>
                  {isLoan ? <Button size="sm" variant="outline" icon={Pencil} label={t('edit')} onPress={() => setEditingLoan(true)} /> : null}
                </TwView>
                {view.facts.map((fact, index) => (
                  <TwView key={fact.key} className={cn('flex-row justify-between gap-3 py-2', index > 0 && 'border-t border-glass-border')}>
                    <Text className="text-sm text-on-surface-variant">{fact.label}</Text>
                    <Text weight="medium" className="shrink text-right text-sm">
                      {fact.value}
                    </Text>
                  </TwView>
                ))}
              </Card>
            </TwView>
          ) : null}

          {shown === 'amortization' ? <Card className="gap-2">{scheduleRows(view.schedule)}</Card> : null}

          {shown === 'lent' ? (
            <TwView className="gap-3">
              <TwView className="flex-row items-center justify-between gap-3">
                <TwView className="flex-row items-center gap-2">
                  <Text accessibilityRole="header" weight="bold" className="text-base">
                    {t(personal ? 'lent.titlePersonal' : 'lent.titlePurchase')}
                  </Text>
                  {personal ? <InfoHint label={t('lent.titlePersonal')} text={t('lent.hintPersonal')} closeLabel={l.t('common.close')} /> : null}
                </TwView>
                <Button size="sm" variant="outline" icon={Plus} label={t(personal ? 'lent.addPersonal' : 'lent.addPurchase')} onPress={() => setCharge({})} />
              </TwView>
              <Card className="gap-1">
                {view.lent.map((row, index) => (
                  <TwView key={row.key} className={cn('flex-row items-center gap-3 py-2', index > 0 && 'border-t border-glass-border')}>
                    <TwView className="min-w-0 flex-1">
                      <Text weight="medium" numberOfLines={2} className="text-sm">
                        {row.description}
                      </Text>
                      <Text className="text-xs text-on-surface-variant">
                        {[row.dateLabel, row.method, row.installments ? t('lent.installments', { count: row.installments }) : null].filter(Boolean).join(' · ')}
                      </Text>
                    </TwView>
                    <TwView className="items-end">
                      <Text weight="bold" className="text-sm" style={{ fontVariant: ['tabular-nums'] }}>
                        {row.amount}
                      </Text>
                      {row.total ? <Text className="text-xs text-on-surface-variant">{t('lent.toRepay', { amount: row.total })}</Text> : null}
                    </TwView>
                    {row.chargeId ? (
                      <TwView className="flex-row">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          icon={Pencil}
                          label={t('edit')}
                          onPress={() => setCharge({ charge: debt.charges.find((c) => c.id === row.chargeId) })}
                        />
                        <Button size="icon-sm" variant="ghost" icon={Trash2} label={t('deleteCharge')} onPress={() => askDeleteCharge(row.chargeId!)} />
                      </TwView>
                    ) : null}
                  </TwView>
                ))}
              </Card>
            </TwView>
          ) : null}

          {shown === 'payments' ? (
            <TwView className="gap-4">
              {personal && debt.recurringExpenseId ? (
                <TwView className="gap-2">
                  <TwView className="flex-row items-center gap-2">
                    <Text accessibilityRole="header" weight="bold" className="text-base">
                      {t('scheduledTitle')}
                    </Text>
                    <InfoHint label={t('scheduledTitle')} text={t('scheduledHint')} closeLabel={l.t('common.close')} />
                  </TwView>
                  <Card className="gap-2">{scheduleRows(view.schedule)}</Card>
                </TwView>
              ) : null}
              <TwView className="gap-2">
                <TwView className="flex-row items-center gap-2">
                  <Text accessibilityRole="header" weight="bold" className="text-base">
                    {t('paymentsTitle')}
                  </Text>
                  <InfoHint label={t('paymentsTitle')} text={t('paymentsHint')} closeLabel={l.t('common.close')} />
                </TwView>
                <Card className="gap-1">
                  {view.payments.length === 0 ? (
                    <Text className="text-sm text-on-surface-variant">{t('paymentsEmpty')}</Text>
                  ) : (
                    view.payments.map((payment, index) => (
                      <TwView key={payment.id} className={cn('flex-row items-center justify-between gap-3 py-2', index > 0 && 'border-t border-glass-border')}>
                        <TwView className="min-w-0 flex-1">
                          <Text className="text-sm">{payment.dateLabel}</Text>
                          <Text className="text-xs text-on-surface-variant">{t(payment.isHistorical ? 'historical' : 'counted')}</Text>
                        </TwView>
                        <Text weight="bold" className="text-sm" style={{ fontVariant: ['tabular-nums'] }}>
                          {payment.amount}
                        </Text>
                        {payment.isHistorical ? (
                          <Button size="icon-sm" variant="ghost" icon={Trash2} label={t('deletePayment')} onPress={() => askDeletePayment(payment.id)} />
                        ) : null}
                      </TwView>
                    ))
                  )}
                </Card>
              </TwView>
            </TwView>
          ) : null}

          {paying ? (
            <PaymentSheet
              debt={debt}
              remainingLabel={view.remaining}
              installment={
                paying.row?.occurrenceId
                  ? { occurrenceId: paying.row.occurrenceId, amount: paying.row.dueAmount, dateLabel: paying.row.dateLabel, amountLabel: paying.row.amountLabel }
                  : undefined
              }
              pending={container ? pendingPayments(view.schedule) : undefined}
              accounts={view.accounts}
              categories={view.categories}
              today={today}
              onClose={() => setPaying(null)}
              onSaved={() => {
                setPaying(null);
                changed(l.t('debts.toasts.paid', { name: view.name }));
              }}
            />
          ) : null}
          {charge ? (
            <ChargeSheet
              debt={debt}
              charge={charge.charge}
              accounts={view.accounts}
              categories={view.categories}
              today={today}
              onClose={() => setCharge(null)}
              onSaved={() => {
                setCharge(null);
                changed(t(charge.charge ? 'chargeUpdated' : 'chargeAdded'));
              }}
            />
          ) : null}
          {editingLoan ? (
            <LoanEditSheet
              debt={debt}
              today={today}
              onClose={() => setEditingLoan(false)}
              onSaved={(didChange) => {
                setEditingLoan(false);
                if (didChange) changed(t('detailsSaved'));
                else toast.info(l.t('debts.toasts.noChanges'));
              }}
            />
          ) : null}
          {rescheduling?.occurrenceId ? (
            <RescheduleSheet
              row={{ ...rescheduling, occurrenceId: rescheduling.occurrenceId }}
              onClose={() => setRescheduling(null)}
              onSaved={() => {
                setRescheduling(null);
                changed(t('rescheduled'));
              }}
            />
          ) : null}
          {linking?.linkOccurrenceId ? (
            <LinkExpenseSheet
              occurrenceId={linking.linkOccurrenceId}
              dateLabel={linking.dateLabel}
              amountLabel={linking.amountLabel}
              today={today}
              onClose={() => setLinking(null)}
              onLinked={() => {
                setLinking(null);
                changed(tl('expense.done'));
              }}
            />
          ) : null}
          {unlinking?.unlinkOccurrenceId ? (
            <UnlinkLoanSheet
              occurrenceId={unlinking.unlinkOccurrenceId}
              onClose={() => setUnlinking(null)}
              onUnlinked={() => {
                setUnlinking(null);
                changed(tl('unlink.done'));
              }}
            />
          ) : null}
          {editingInstallment?.editOccurrenceId ? (
            <InstallmentEditSheet
              row={{ ...editingInstallment, editOccurrenceId: editingInstallment.editOccurrenceId }}
              total={debt.installmentsTotal ?? view.schedule.length}
              terms={view.cardTerms}
              onClose={() => setEditingInstallment(null)}
              onSaved={() => {
                setEditingInstallment(null);
                changed(t('editInstallment.saved'));
              }}
            />
          ) : null}
        </TwView>
      ) : null}
    </Screen>
  );
}

/**
 * One payment of the schedule: number, date (and the one it was moved
 * from), what it covers (an info sheet lists every concept), the amount
 * (and what is paid of it), status and actions.
 */
function ScheduleItem({
  row,
  first,
  statusLabel,
  onPay,
  onReschedule,
  onEdit,
  onLink,
  onOpenMovement,
  onUnlink,
}: {
  row: ScheduleRow;
  first: boolean;
  statusLabel: string;
  onPay?: () => void;
  onReschedule?: () => void;
  onEdit?: () => void;
  onLink?: () => void;
  onOpenMovement?: () => void;
  onUnlink?: () => void;
}) {
  const t = useTranslations('debts.detail');
  const tl = useTranslations('debts.links');
  const l = useLocalizer();
  const [concept, ...more] = row.concepts;
  return (
    <TwView className={cn('gap-2 py-2', !first && 'border-t border-glass-border')}>
      <TwView className="flex-row items-start gap-3">
        <Text className="w-7 pt-0.5 text-xs text-on-surface-variant">{row.number}</Text>
        <TwView className="min-w-0 flex-1 gap-0.5">
          <Text className="text-sm">{row.dateLabel}</Text>
          {row.originalDateLabel ? <Text className="text-[11px] text-on-surface-variant line-through">{row.originalDateLabel}</Text> : null}
          {concept ? (
            <TwView className="flex-row items-center gap-1.5">
              <Text numberOfLines={1} className="shrink text-xs text-on-surface-variant">
                {concept}
              </Text>
              {more.length > 0 ? (
                <InfoHint label={t('columns.concepts')} items={row.concepts} closeLabel={l.t('common.close')}>
                  <TwView className="rounded-full bg-track px-1.5">
                    <Text className="text-[11px] text-on-surface-variant">{t('conceptsMore', { count: more.length })}</Text>
                  </TwView>
                </InfoHint>
              ) : null}
            </TwView>
          ) : null}
        </TwView>
        <TwView className="items-end gap-1">
          <Text weight="bold" className="text-sm" style={{ fontVariant: ['tabular-nums'] }}>
            {row.amountLabel}
          </Text>
          {row.partialLabel ? <Text className="text-[11px] text-on-surface-variant">{row.partialLabel}</Text> : null}
          <Badge variant={STATUS_VARIANT[row.status]} label={statusLabel} />
        </TwView>
      </TwView>
      {onPay || onReschedule || onEdit || onLink || onOpenMovement || onUnlink ? (
        <TwView className="flex-row flex-wrap justify-end gap-1">
          {onEdit ? <Button size="icon-sm" variant="ghost" icon={Pencil} label={t('editInstallment.action')} onPress={onEdit} /> : null}
          {onReschedule ? <Button size="icon-sm" variant="ghost" icon={CalendarClock} label={t('reschedule')} onPress={onReschedule} /> : null}
          {onLink ? <Button size="sm" variant="outline" icon={Link2} label={tl('linkPaid')} onPress={onLink} /> : null}
          {onOpenMovement ? <Button size="icon-sm" variant="ghost" icon={Receipt} label={tl('viewMovement')} onPress={onOpenMovement} /> : null}
          {onUnlink ? <Button size="icon-sm" variant="ghost" icon={Unlink} label={tl('unlink.action')} onPress={onUnlink} /> : null}
          {onPay ? <Button size="sm" variant="outline" label={t('payThis')} onPress={onPay} /> : null}
        </TwView>
      ) : null}
    </TwView>
  );
}
