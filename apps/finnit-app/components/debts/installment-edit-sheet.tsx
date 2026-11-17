import * as React from 'react';
import { useTranslations } from 'use-intl';

import { debtErrorMessage, updateCardInstallment } from '@finnit/core/debts/api';
import { cutoffFor, cutoffsFrom, dueDateAfter, type CardCutTerms } from '@finnit/core/debts/card-installments';
import type { ScheduleRow } from '@finnit/core/debts/detail-view';
import { addDays, isDayKey, shortDate, type DayKey } from '@finnit/core/finance/dates';
import { parseAmount } from '@finnit/core/new-entry/form';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { DatePicker } from '@finnit/ui-native/components/ui/date-picker';
import { MoneyInput } from '@finnit/ui-native/components/ui/money-input';
import { Select } from '@finnit/ui-native/components/ui/select';
import { Sheet } from '@finnit/ui-native/components/ui/sheet';
import { Switch } from '@finnit/ui-native/components/ui/switch';
import { Text } from '@finnit/ui-native/components/ui/text';

import { useGql } from '@/lib/graphql/runner';
import { useLocalizer } from '@/lib/i18n/i18n-provider';

/**
 * The web's InstallmentEditDialog: one installment of a card purchase, the
 * cut-off that bills it (a free date without the card's terms) and its
 * amount; optionally the next ones follow it. Mounted while open.
 */
export function InstallmentEditSheet({
  row,
  total,
  terms,
  onClose,
  onSaved,
}: {
  row: ScheduleRow & { editOccurrenceId: string };
  total: number;
  /** The card's cut-off and payment days, when known. */
  terms: CardCutTerms | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const te = useTranslations('debts.detail.editInstallment');
  const { t, locale } = useLocalizer();
  const gql = useGql();
  const [day, setDay] = React.useState<DayKey | ''>(terms ? cutoffFor(row.dueDate, terms) : row.dueDate);
  // From a year before to two years after, around its cut-off.
  const cutoffs = React.useMemo(
    () => (terms ? cutoffsFrom(addDays(cutoffFor(row.dueDate, terms), -366), 37, terms) : null),
    [terms, row.dueDate],
  );
  const cutoffLabel = (cut: DayKey) => {
    const due = terms ? dueDateAfter(cut, terms) : null;
    return due ? t('debts.cardInstallments.scheduleCutoff', { cut: shortDate(cut, locale), due: shortDate(due, locale) }) : shortDate(cut, locale);
  };
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
      description={te(terms ? 'descriptionCutoff' : 'description')}
      closeLabel={t('common.close')}
    >
      <TwView className="gap-4">
        {cutoffs ? (
          <Select
            label={te('cutoff')}
            options={cutoffs.map((cut) => ({ value: cut, label: cutoffLabel(cut) }))}
            value={day || null}
            onValueChange={(next) => setDay(next)}
            closeLabel={t('common.close')}
          />
        ) : (
          <DatePicker label={te('date')} value={day || undefined} onChange={(next) => setDay(next ?? '')} locale={locale} closeLabel={t('common.close')} />
        )}
        <MoneyInput label={te('amount')} value={amount} onValueChange={setAmount} error={amountError} />
        {isLast ? null : (
          <TwView className="flex-row items-center gap-3">
            <Text className="flex-1 text-sm">{te(terms ? 'shiftCutoffs' : 'shift')}</Text>
            <Switch checked={shift} onCheckedChange={setShift} accessibilityLabel={te(terms ? 'shiftCutoffs' : 'shift')} />
          </TwView>
        )}
        {error ? <Text className="text-[13px] text-expense">{error}</Text> : null}
        <Button label={saving ? te('saving') : te('save')} onPress={() => void save()} disabled={saving} className="w-full" />
      </TwView>
    </Sheet>
  );
}
