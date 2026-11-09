import * as React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslations } from 'use-intl';

import { Link2, Pencil, Receipt, Unlink } from 'lucide-react-native';

import { buildLoanDetailView, type ScheduleRow, type ScheduleRowStatus } from '@finnit/core/debts/detail-view';
import { DEBT_DETAIL_QUERY, type DebtDetailResult } from '@finnit/core/debts/request';
import { isCardInstallments } from '@finnit/core/debts/types';
import { todayKey } from '@finnit/core/finance/dates';
import { cn } from '@finnit/ui-native/lib/utils';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Badge, type BadgeVariant } from '@finnit/ui-native/components/ui/badge';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Card } from '@finnit/ui-native/components/ui/card';
import { Progress } from '@finnit/ui-native/components/ui/progress';
import { Text } from '@finnit/ui-native/components/ui/text';
import { toast } from '@finnit/ui-native/components/ui/toaster';

import { InstallmentEditSheet } from '@/components/debts/installment-edit-sheet';
import { LinkExpenseSheet } from '@/components/loan-links/link-expense-sheet';
import { UnlinkLoanSheet } from '@/components/loan-links/unlink-loan-sheet';
import { Screen } from '@/components/shell/screen';
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

/**
 * One debt (the web's /planning/debts/[id]): what's left, its terms,
 * schedule and payments. A payment takes an existing expense ("Ligar
 * gasto"); one paid by an expense opens it or unlinks it.
 */
export function DebtDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTranslations('debts.detail');
  const tl = useTranslations('debts.links');
  const router = useRouter();
  const [linking, setLinking] = React.useState<ScheduleRow | null>(null);
  const [unlinking, setUnlinking] = React.useState<ScheduleRow | null>(null);
  const [editing, setEditing] = React.useState<ScheduleRow | null>(null);
  const today = todayKey();
  const { view, loading, error, refreshing, refresh } = useView({
    query: DEBT_DETAIL_QUERY,
    variables: { id, debtId: id },
    build: (data: DebtDetailResult, l) => buildLoanDetailView(data.debt, data.loanSchedule, { today, categories: data.categories }, l),
  });
  useOnTransactionsChanged(refresh);

  // Reloads this screen too (it listens) and the lists that show movements.
  const changed = (message: string) => {
    toast.success(message);
    emitTransactionsChanged(null);
  };

  return (
    <Screen
      title={view?.name ?? t('back')}
      subtitle={view?.lenderName ?? undefined}
      back
      withBottomNav={false}
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      {view ? (
        <TwView className="gap-4">
          <Card className="gap-3">
            <Text className="text-xs text-on-surface-variant">{t('remaining')}</Text>
            <Text weight="bold" className="text-3xl" style={{ fontVariant: ['tabular-nums'] }}>
              {view.remaining}
            </Text>
            <Progress value={view.paidPercent} indicatorColor="var(--income)" accessibilityLabel={t('progress', { percent: view.paidPercent })} />
            <Text className="text-xs text-on-surface-variant">{t('progress', { percent: view.paidPercent })}</Text>
            <Text weight="medium" className={cn('text-sm', view.next?.overdue ? 'text-expense' : 'text-on-background')}>
              {view.next
                ? t(view.next.overdue ? 'nextOverdue' : 'next', { date: view.next.dateLabel, amount: view.next.amountLabel })
                : t('noNext')}
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

          {isCardInstallments(view.debt) ? (
            <Card className="gap-2">
              <Text className="text-sm">{view.debt.purchaseTransactionId ? t('cardPurchase.linked') : t('cardPurchase.unlinked')}</Text>
              {view.debt.purchaseTransactionId ? (
                <Button
                  size="sm"
                  variant="outline"
                  icon={Receipt}
                  label={t('cardPurchase.open')}
                  onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: view.debt.purchaseTransactionId! } })}
                />
              ) : null}
            </Card>
          ) : null}

          {view.facts.length > 0 ? (
            <Card className="gap-1">
              {view.facts.map((fact, index) => (
                <TwView key={fact.key} className={cn('flex-row justify-between gap-3 py-2', index > 0 && 'border-t border-glass-border')}>
                  <Text className="text-sm text-on-surface-variant">{fact.label}</Text>
                  <Text weight="medium" className="shrink text-right text-sm">
                    {fact.value}
                  </Text>
                </TwView>
              ))}
            </Card>
          ) : null}

          <Card className="gap-2">
            {view.schedule.length === 0 ? (
              <Text className="text-sm text-on-surface-variant">{t('scheduleEmpty')}</Text>
            ) : (
              view.schedule.map((row, index) => (
                <TwView key={row.key} className={cn('flex-row items-center gap-3 py-2', index > 0 && 'border-t border-glass-border')}>
                  <Text className="w-7 text-xs text-on-surface-variant">{row.number}</Text>
                  <TwView className="min-w-0 flex-1">
                    <Text className="text-sm">{row.dateLabel}</Text>
                    {row.originalDateLabel ? <Text className="text-[11px] text-on-surface-variant line-through">{row.originalDateLabel}</Text> : null}
                  </TwView>
                  <TwView className="items-end gap-1">
                    <Text weight="bold" className="text-sm" style={{ fontVariant: ['tabular-nums'] }}>
                      {row.amountLabel}
                    </Text>
                    <Badge variant={STATUS_VARIANT[row.status]} label={t(`status.${row.status}`)} />
                    {row.editOccurrenceId ? (
                      <Button size="icon-sm" variant="ghost" icon={Pencil} label={t('editInstallment.action')} onPress={() => setEditing(row)} />
                    ) : null}
                    {row.linkOccurrenceId ? (
                      <Button size="sm" variant="outline" icon={Link2} label={tl('linkPaid')} onPress={() => setLinking(row)} />
                    ) : null}
                    {row.unlinkOccurrenceId && row.transactionId ? (
                      <TwView className="flex-row gap-1">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          icon={Receipt}
                          label={tl('viewMovement')}
                          onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: row.transactionId! } })}
                        />
                        <Button size="icon-sm" variant="ghost" icon={Unlink} label={tl('unlink.action')} onPress={() => setUnlinking(row)} />
                      </TwView>
                    ) : null}
                  </TwView>
                </TwView>
              ))
            )}
          </Card>

          <Card className="gap-2">
            <Text accessibilityRole="header" weight="bold" className="text-sm">
              {t('paymentsTitle')}
            </Text>
            {view.payments.length === 0 ? (
              <Text className="text-sm text-on-surface-variant">{t('paymentsEmpty')}</Text>
            ) : (
              view.payments.map((payment, index) => (
                <TwView key={payment.id} className={cn('flex-row items-center justify-between gap-3 py-2', index > 0 && 'border-t border-glass-border')}>
                  <Text className="text-sm">{payment.dateLabel}</Text>
                  <Text weight="bold" className="text-sm" style={{ fontVariant: ['tabular-nums'] }}>
                    {payment.amount}
                  </Text>
                </TwView>
              ))
            )}
          </Card>
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
          {editing?.editOccurrenceId ? (
            <InstallmentEditSheet
              row={{ ...editing, editOccurrenceId: editing.editOccurrenceId }}
              total={view.debt.installmentsTotal ?? view.schedule.length}
              onClose={() => setEditing(null)}
              onSaved={() => {
                setEditing(null);
                changed(t('editInstallment.saved'));
              }}
            />
          ) : null}
        </TwView>
      ) : null}
    </Screen>
  );
}
