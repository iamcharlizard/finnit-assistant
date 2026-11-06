import * as React from 'react';
import { useTranslations } from 'use-intl';

import { debtErrorMessage } from '@finnit/core/debts/api';
import { unlinkLoanPayment } from '@finnit/core/debts/links';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Sheet } from '@finnit/ui-native/components/ui/sheet';
import { Text } from '@finnit/ui-native/components/ui/text';

import { useGql } from '@/lib/graphql/runner';
import { useLocalizer } from '@/lib/i18n/i18n-provider';
import { ChoiceRow } from './choice-row';

/** "Desligar": the expense stays as a plain one; the payment reopens or stays paid without a movement. */
export function UnlinkLoanSheet({ occurrenceId, onClose, onUnlinked }: { occurrenceId: string; onClose: () => void; onUnlinked: () => void }) {
  const l = useLocalizer();
  const gql = useGql();
  const t = useTranslations('debts.links.unlink');
  const tc = useTranslations('common');
  const [keepPaid, setKeepPaid] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await unlinkLoanPayment(occurrenceId, keepPaid, gql);
      onUnlinked();
    } catch (e) {
      setError(debtErrorMessage(e, l.t));
      setSaving(false);
    }
  }

  return (
    <Sheet open onOpenChange={(next) => !next && !saving && onClose()} title={t('title')} description={t('description')} closeLabel={tc('close')}>
      <TwView accessibilityRole="radiogroup" className="gap-2">
        <ChoiceRow selected={!keepPaid} title={t('reopen')} meta={t('reopenHint')} onPress={() => setKeepPaid(false)} />
        <ChoiceRow selected={keepPaid} title={t('keepPaid')} meta={t('keepPaidHint')} onPress={() => setKeepPaid(true)} />
      </TwView>
      {error ? <Text className="mt-2 text-[13px] text-expense">{error}</Text> : null}
      <Button label={saving ? t('saving') : t('confirm')} onPress={save} disabled={saving} className="mt-4 w-full" />
    </Sheet>
  );
}
