import * as React from 'react';
import { useTranslations } from 'use-intl';

import { debtErrorMessage, updateCardInstallment } from '@finnit/core/debts/api';
import type { ScheduleRow } from '@finnit/core/debts/detail-view';
import { isDayKey, type DayKey } from '@finnit/core/finance/dates';
import { parseAmount } from '@finnit/core/new-entry/form';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { DatePicker } from '@finnit/ui-native/components/ui/date-picker';
import { MoneyInput } from '@finnit/ui-native/components/ui/money-input';
import { Sheet } from '@finnit/ui-native/components/ui/sheet';
import { Switch } from '@finnit/ui-native/components/ui/switch';
import { Text } from '@finnit/ui-native/components/ui/text';

import { useGql } from '@/lib/graphql/runner';
import { useLocalizer } from '@/lib/i18n/i18n-provider';

/**
 * The web's InstallmentEditDialog: one installment of a card purchase, its
 * billing day and amount; optionally the next ones go to that day of the
 * following months. Mounted while open.
 */
export function InstallmentEditSheet({
  row,
  total,
  onClose,
  onSaved,
}: {
  row: ScheduleRow & { editOccurrenceId: string };
  total: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const te = useTranslations('debts.detail.editInstallment');
  const { t, locale } = useLocalizer();
  const gql = useGql();
  const [day, setDay] = React.useState<DayKey | ''>(row.dueDate);
  const [amount, setAmount] = React.useState(row.amount.toFixed(2));
  const [shift, setShift] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const value = parseAmount(amount);
  const amountError = value === null || value <= 0 ? te('amountRequired') : undefined;
  const isLast = row.number >= total;

  async function save() {
    if (!isDayKey(day)) {
      setError(te('dateRequired'));
      return;
    }
    if (amountError || value === null) return;
    setSaving(true);
    setError(null);
    try {
      await updateCardInstallment(
        { occurrenceId: row.editOccurrenceId, dueDate: day, amount: value, shiftFollowing: shift && !isLast },
        gql,
      );
      onSaved();
    } catch (cause) {
      setError(debtErrorMessage(cause, t));
      setSaving(false);
    }
  }

  return (
    <Sheet
      open
      onOpenChange={(next) => !next && !saving && onClose()}
      title={te('title', { number: row.number, total })}
      description={te('description')}
      closeLabel={t('common.close')}
    >
      <TwView className="gap-4">
        <DatePicker label={te('date')} value={day || undefined} onChange={(next) => setDay(next ?? '')} locale={locale} closeLabel={t('common.close')} />
        <MoneyInput label={te('amount')} value={amount} onValueChange={setAmount} error={amountError} />
        {isLast ? null : (
          <TwView className="flex-row items-center gap-3">
            <Text className="flex-1 text-sm">{te('shift')}</Text>
            <Switch checked={shift} onCheckedChange={setShift} accessibilityLabel={te('shift')} />
          </TwView>
        )}
        {error ? <Text className="text-[13px] text-expense">{error}</Text> : null}
        <Button label={saving ? te('saving') : te('save')} onPress={() => void save()} disabled={saving} className="w-full" />
      </TwView>
    </Sheet>
  );
}
