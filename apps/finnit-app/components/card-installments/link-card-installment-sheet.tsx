import * as React from 'react';
import { useTranslations } from 'use-intl';
import { Plus, Unlink } from 'lucide-react-native';

import {
  choiceKey,
  initialCardInstallmentChoice,
  linkCardInstallment,
  loadCardInstallmentLinkOptions,
  toCardInstallmentLinkView,
  unlinkCardInstallment,
  type ApiCardInstallmentLinkOptions,
  type CardInstallmentChoice,
} from '@finnit/core/debts/card-installment-links';
import { dayKeyOf, shortDate } from '@finnit/core/finance/dates';
import { formatMoney } from '@finnit/core/finance/money';
import { transactionErrorMessage } from '@finnit/core/transaction-detail/api';
import { TwScrollView, TwView } from '@finnit/ui-native/lib/tw';
import { Badge } from '@finnit/ui-native/components/ui/badge';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Sheet } from '@finnit/ui-native/components/ui/sheet';
import { Text } from '@finnit/ui-native/components/ui/text';

import { ChoiceRow } from '@/components/loan-links/choice-row';
import { useGql } from '@/lib/graphql/runner';
import { useLocalizer } from '@/lib/i18n/i18n-provider';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; options: ApiCardInstallmentLinkOptions };

/**
 * "Ligar a compra a meses" (the web's LinkCardInstallmentDialog): the
 * expense on a credit card is the whole purchase or one installment of one
 * of the card's purchases in installments; already linked, it says to what
 * and unlinks. Mounted while open.
 */
export function LinkCardInstallmentSheet({
  transaction,
  onClose,
  onChanged,
  onCreate,
}: {
  transaction: {
    id: string;
    amount: number;
    currency: string;
    txnDate: string;
  };
  onClose: () => void;
  onChanged: (message: string) => void;
  /** "Crear compra a meses con este gasto". */
  onCreate: () => void;
}) {
  const t = useTranslations('transaction.linkCardInstallment');
  const l = useLocalizer();
  const gql = useGql();
  const [state, setState] = React.useState<State>({ status: 'loading' });
  const [picked, setPicked] = React.useState<CardInstallmentChoice | null>(
    null,
  );
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let live = true;
    loadCardInstallmentLinkOptions(transaction.id, gql)
      .then((options) => {
        if (!live) return;
        setState({ status: 'ready', options });
        setPicked(initialCardInstallmentChoice(options));
      })
      .catch(
        (e: unknown) =>
          live &&
          setState({
            status: 'error',
            message: transactionErrorMessage(e, l.t),
          }),
      );
    return () => {
      live = false;
    };
  }, [transaction.id, gql, l]);

  const options = state.status === 'ready' ? state.options : null;
  const view = options
    ? toCardInstallmentLinkView(options, transaction.currency, l)
    : null;
  const linked = options?.linked ?? null;
  const pickedKey = picked ? choiceKey(picked) : null;
  const pickedPlan = options?.plans.find((p) => p.debtId === picked?.debtId);

  async function run(action: () => Promise<void>, message: string) {
    setSaving(true);
    setError(null);
    try {
      await action();
      onChanged(message);
    } catch (e) {
      setError(transactionErrorMessage(e, l.t));
      setSaving(false);
    }
  }

  return (
    <Sheet
      open
      onOpenChange={(next) => !next && !saving && onClose()}
      title={t('title')}
      description={t('description', {
        amount: formatMoney(transaction.amount, transaction.currency, l.locale),
        date: shortDate(dayKeyOf(transaction.txnDate), l.locale),
      })}
      closeLabel={l.t('common.close')}
    >
      {state.status === 'loading' ? (
        <Text className="text-sm text-on-surface-variant">{t('loading')}</Text>
      ) : null}
      {state.status === 'error' ? (
        <Text className="text-sm text-expense">{state.message}</Text>
      ) : null}

      {view?.linked && linked ? (
        <TwView className="gap-3 rounded-2xl bg-track p-3">
          <Text className="text-sm">{view.linked}</Text>
          <Button
            variant="outline"
            size="sm"
            icon={Unlink}
            label={t('unlink')}
            disabled={saving}
            onPress={() =>
              void run(
                () => unlinkCardInstallment(linked, gql),
                t('unlinked', { name: linked.name }),
              )
            }
          />
        </TwView>
      ) : null}

      {view && !linked ? (
        <TwScrollView
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: 420 }}
          contentContainerClassName="gap-4 pb-2"
        >
          {view.plans.length === 0 ? (
            <Text className="text-sm text-on-surface-variant">
              {t('empty')}
            </Text>
          ) : null}
          {view.plans.map((plan) => (
            <TwView key={plan.debtId} className="gap-2">
              <TwView className="px-1">
                <Text weight="bold" className="text-sm">
                  {plan.name}
                </Text>
                <Text className="text-xs text-on-surface-variant">
                  {plan.detail}
                </Text>
              </TwView>
              {plan.note ? (
                <Text className="px-1 text-xs text-on-surface-variant">
                  {plan.note}
                </Text>
              ) : null}
              {plan.rows.map((row) => (
                <ChoiceRow
                  key={row.key}
                  selected={pickedKey === row.key}
                  title={row.title}
                  meta={row.meta}
                  badges={
                    row.proposed ? (
                      <Badge label={t('proposed')} variant="brand" />
                    ) : null
                  }
                  onPress={() => setPicked(row.choice)}
                />
              ))}
            </TwView>
          ))}
          <Button
            variant="ghost"
            size="sm"
            icon={Plus}
            label={t('create')}
            disabled={saving}
            onPress={onCreate}
          />
        </TwScrollView>
      ) : null}

      {error ? (
        <Text className="mt-2 text-sm text-expense">{error}</Text>
      ) : null}
      {!linked ? (
        <Button
          label={t('submit')}
          onPress={() =>
            picked && pickedPlan
              ? void run(
                  () => linkCardInstallment(transaction.id, picked, gql),
                  t('done', { name: pickedPlan.name }),
                )
              : undefined
          }
          disabled={saving || !picked}
          className="mt-3 w-full"
        />
      ) : null}
    </Sheet>
  );
}
