import * as React from 'react';
import { useTranslations } from 'use-intl';

import { debtErrorMessage, rescheduleLoanPayment } from '@finnit/core/debts/api';
import type { ScheduleRow } from '@finnit/core/debts/detail-view';
import { isDayKey, type DayKey } from '@finnit/core/finance/dates';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { DatePicker } from '@finnit/ui-native/components/ui/date-picker';
import { Sheet } from '@finnit/ui-native/components/ui/sheet';
import { Text } from '@finnit/ui-native/components/ui/text';

import { useGql } from '@/lib/graphql/runner';
import { useLocalizer } from '@/lib/i18n/i18n-provider';

/** The web's RescheduleDialog: an open payment of a loan moved to another day. */
export function RescheduleSheet({
  row,
  onClose,
  onSaved,
}: {
  row: ScheduleRow & { occurrenceId: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const td = useTranslations('debts.detail');
  const { t, locale } = useLocalizer();
  const gql = useGql();
  const [day, setDay] = React.useState<DayKey | ''>(row.dueDate);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save() {
    if (!isDayKey(day)) return;
    setSaving(true);
    setError(null);
    try {
      await rescheduleLoanPayment(row.occurrenceId, day, gql);
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
      title={td('rescheduleTitle')}
      description={td('rescheduleDescription', { date: row.dateLabel, amount: row.amountLabel })}
      closeLabel={t('common.close')}
      footer={<Button label={saving ? td('saving') : td('rescheduleSave')} onPress={() => void save()} disabled={saving || !isDayKey(day)} className="w-full" />}
    >
      <TwView className="gap-4 pb-2">
        <DatePicker label={td('rescheduleDate')} value={day || undefined} onChange={(next) => setDay(next ?? '')} locale={locale} closeLabel={t('common.close')} />
        <Text className="text-xs text-on-surface-variant">{td('rescheduleHint')}</Text>
        {error ? <Text className="text-[13px] text-expense">{error}</Text> : null}
      </TwView>
    </Sheet>
  );
}
