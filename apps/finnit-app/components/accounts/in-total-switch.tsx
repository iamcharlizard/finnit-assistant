import * as React from 'react';
import { useTranslations } from 'use-intl';

import {
  accountErrorMessage,
  setAccountInTotal,
} from '@finnit/core/accounts/api';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Switch } from '@finnit/ui-native/components/ui/switch';
import { Text } from '@finnit/ui-native/components/ui/text';
import { toast } from '@finnit/ui-native/components/ui/toaster';

import { useGql } from '@/lib/graphql/runner';
import { useLocalizer } from '@/lib/i18n/i18n-provider';
import { emitTransactionsChanged } from '@/lib/transactions/events';

/**
 * "Incluir en el saldo total": off, the account doesn't add up to the
 * available balance, card debt or the accounts total. Saves at once.
 */
export function InTotalSwitch({
  accountId,
  included,
}: {
  accountId: string;
  included: boolean;
}) {
  const t = useTranslations('accounts.inTotal');
  const l = useLocalizer();
  const gql = useGql();
  const [value, setValue] = React.useState(included);
  const [saving, setSaving] = React.useState(false);

  async function change(next: boolean) {
    setValue(next);
    setSaving(true);
    try {
      await setAccountInTotal(accountId, next, gql);
      emitTransactionsChanged();
    } catch (error) {
      setValue(!next);
      toast.error(accountErrorMessage(error, l.t) || t('error'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <TwView className="flex-row items-center gap-3 rounded-card border border-outline-variant bg-surface p-4">
      <TwView className="flex-1 gap-0.5">
        <Text weight="medium" className="text-sm text-on-background">
          {t('label')}
        </Text>
        <Text className="text-xs text-on-surface-variant">{t('hint')}</Text>
      </TwView>
      <Switch
        checked={value}
        onCheckedChange={(next) => void change(next)}
        disabled={saving}
        accessibilityLabel={t('label')}
      />
    </TwView>
  );
}
