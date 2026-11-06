import * as React from 'react';
import { useTranslations } from 'use-intl';

import { debtErrorMessage } from '@finnit/core/debts/api';
import { linkLoanPayment } from '@finnit/core/debts/links';
import type { DayKey } from '@finnit/core/finance/dates';
import { TwScrollView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Sheet } from '@finnit/ui-native/components/ui/sheet';
import { Text } from '@finnit/ui-native/components/ui/text';

import { useGql } from '@/lib/graphql/runner';
import { useLocalizer } from '@/lib/i18n/i18n-provider';
import { ExpensePicker } from './expense-picker';

/** "Ligar gasto" on a loan payment (open, or paid without a movement): pick the expense that paid it. */
export function LinkExpenseSheet({
  occurrenceId,
  dateLabel,
  amountLabel,
  today,
  onClose,
  onLinked,
}: {
  occurrenceId: string;
  dateLabel: string;
  amountLabel: string;
  today: DayKey;
  onClose: () => void;
  onLinked: () => void;
}) {
  const l = useLocalizer();
  const gql = useGql();
  const t = useTranslations('debts.links');
  const tc = useTranslations('common');
  const [transactionId, setTransactionId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save() {
    if (!transactionId) return;
    setSaving(true);
    setError(null);
    try {
      await linkLoanPayment(occurrenceId, transactionId, gql);
      onLinked();
    } catch (e) {
      setError(debtErrorMessage(e, l.t));
      setSaving(false);
    }
  }

  return (
    <Sheet
      open
      onOpenChange={(next) => !next && !saving && onClose()}
      title={t('expense.title')}
      description={t('expense.description', { date: dateLabel, amount: amountLabel })}
      closeLabel={tc('close')}
    >
      <TwScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 520 }} contentContainerClassName="gap-4 pb-2">
        <ExpensePicker occurrenceId={occurrenceId} today={today} value={transactionId} onChange={setTransactionId} />
        {error ? <Text className="text-[13px] text-expense">{error}</Text> : null}
      </TwScrollView>
      <Button label={saving ? t('saving') : t('expense.submit')} onPress={save} disabled={saving || !transactionId} className="mt-3 w-full" />
    </Sheet>
  );
}
