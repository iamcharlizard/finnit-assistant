import * as React from 'react';
import { useTranslations } from 'use-intl';

import { debtErrorMessage } from '@finnit/core/debts/api';
import {
  buildLinkOptionsView,
  initialPaymentOf,
  linkLoanPayment,
  loadLoanLinkOptions,
  type LinkOptionsView,
  type LinkTargetState,
} from '@finnit/core/debts/links';
import { TwScrollView, TwView } from '@finnit/ui-native/lib/tw';
import { Badge, type BadgeVariant } from '@finnit/ui-native/components/ui/badge';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Select } from '@finnit/ui-native/components/ui/select';
import { Sheet } from '@finnit/ui-native/components/ui/sheet';
import { Text } from '@finnit/ui-native/components/ui/text';

import { useGql } from '@/lib/graphql/runner';
import { useLocalizer } from '@/lib/i18n/i18n-provider';
import { ChoiceRow } from './choice-row';

const STATE_BADGE: Record<LinkTargetState, BadgeVariant> = {
  open: 'outline',
  overdue: 'expense',
  paid_without_movement: 'muted',
};

type State = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; view: LinkOptionsView };

/**
 * "Ligar a préstamo" from a movement (the web's LinkLoanDialog): the loan
 * and the payment the expense covers; the one due that day comes selected.
 */
export function LinkLoanSheet({
  transactionId,
  amountLabel,
  onClose,
  onLinked,
}: {
  transactionId: string;
  amountLabel: string;
  onClose: () => void;
  onLinked: (loanName: string) => void;
}) {
  const l = useLocalizer();
  const gql = useGql();
  const t = useTranslations('debts.links');
  const tc = useTranslations('common');
  const [state, setState] = React.useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = React.useState(0);
  const [debtId, setDebtId] = React.useState<string | null>(null);
  const [occurrenceId, setOccurrenceId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let live = true;
    loadLoanLinkOptions(transactionId, gql)
      .then((options) => {
        if (!live) return;
        const view = buildLinkOptionsView(options, l);
        setState({ status: 'ready', view });
        setDebtId(view.initialDebtId);
        setOccurrenceId(view.initialOccurrenceId);
      })
      .catch((e: unknown) => live && setState({ status: 'error', message: debtErrorMessage(e, l.t) }));
    return () => {
      live = false;
    };
  }, [transactionId, gql, l, attempt]);

  const view = state.status === 'ready' ? state.view : null;
  const loan = view?.loans.find((x) => x.debtId === debtId) ?? null;
  const payment = loan?.payments.find((p) => p.occurrenceId === occurrenceId) ?? null;

  async function save() {
    if (!loan || !payment) return;
    setSaving(true);
    setError(null);
    try {
      await linkLoanPayment(payment.occurrenceId, transactionId, gql);
      onLinked(loan.label);
    } catch (e) {
      setError(debtErrorMessage(e, l.t));
      setSaving(false);
    }
  }

  return (
    <Sheet
      open
      onOpenChange={(next) => !next && !saving && onClose()}
      title={t('title')}
      description={t('description', { amount: amountLabel })}
      closeLabel={tc('close')}
    >
      <TwScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 520 }} contentContainerClassName="gap-4 pb-2">
        {state.status === 'loading' ? <Text className="text-sm text-on-surface-variant">{t('loading')}</Text> : null}
        {state.status === 'error' ? (
          <TwView className="flex-row items-center gap-2">
            <Text className="flex-1 text-sm">{state.message}</Text>
            <Button size="sm" variant="outline" label={t('retry')} onPress={() => {
                setState({ status: 'loading' });
                setAttempt((n) => n + 1);
              }}
            />
          </TwView>
        ) : null}
        {view && view.loans.length === 0 ? <Text className="text-sm text-on-surface-variant">{t('noLoans')}</Text> : null}
        {view && view.loans.length > 0 ? (
          <>
            <Select
              label={t('loan')}
              title={t('loan')}
              options={view.loans.map((x) => ({ value: x.debtId, label: x.label }))}
              value={debtId}
              onValueChange={(next) => {
                setDebtId(next);
                const picked = view.loans.find((x) => x.debtId === next);
                setOccurrenceId(picked ? initialPaymentOf(picked) : null);
              }}
              placeholder={t('loanPlaceholder')}
              searchable={view.loans.length > 6}
              searchPlaceholder={t('loanSearch')}
              emptyLabel={t('noResults')}
              closeLabel={tc('close')}
            />
            {loan ? (
              <TwView className="gap-2">
                <Text className="px-1 text-sm text-on-surface-variant">{t('pickPayment')}</Text>
                {loan.payments.length === 0 ? (
                  <Text className="px-1 text-sm text-on-surface-variant">{t('noPayments')}</Text>
                ) : (
                  <TwView accessibilityRole="radiogroup" className="gap-2">
                    {loan.payments.map((p) => (
                      <ChoiceRow
                        key={p.occurrenceId}
                        selected={occurrenceId === p.occurrenceId}
                        title={p.dateLabel}
                        amount={p.amountLabel}
                        badges={
                          <>
                            {p.suggested ? <Badge variant="brand" label={t('suggested')} /> : null}
                            <Badge variant={STATE_BADGE[p.state]} label={t(`states.${p.state}`)} />
                          </>
                        }
                        onPress={() => setOccurrenceId(p.occurrenceId)}
                      />
                    ))}
                  </TwView>
                )}
              </TwView>
            ) : null}
            {payment?.state === 'paid_without_movement' ? <Text className="px-1 text-xs text-on-surface-variant">{t('paidWithoutHint')}</Text> : null}
          </>
        ) : null}
        {error ? <Text className="text-[13px] text-expense">{error}</Text> : null}
      </TwScrollView>
      <Button label={saving ? t('saving') : t('submit')} onPress={save} disabled={saving || !payment} className="mt-3 w-full" />
    </Sheet>
  );
}
