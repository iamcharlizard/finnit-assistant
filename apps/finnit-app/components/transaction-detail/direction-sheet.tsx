import * as React from 'react';
import { useTranslations } from 'use-intl';

import { formatMoney } from '@finnit/core/finance/money';
import { requestErrorMessage } from '@finnit/core/graphql/request';
import {
  DIRECTION_NAME_MAX,
  DIRECTION_PATTERN_MAX,
  buildDirectionInput,
  changeDirection,
  newDirectionForm,
  validateDirectionForm,
  type DirectionChange,
  type DirectionErrors,
  type DirectionForm,
} from '@finnit/core/transaction-detail/direction';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Input } from '@finnit/ui-native/components/ui/input';
import { Sheet } from '@finnit/ui-native/components/ui/sheet';
import { Switch } from '@finnit/ui-native/components/ui/switch';
import { Text } from '@finnit/ui-native/components/ui/text';
import { toast } from '@finnit/ui-native/components/ui/toaster';

import { useGql } from '@/lib/graphql/runner';
import { useLocalizer } from '@/lib/i18n/i18n-provider';

/**
 * "Es un ingreso" / "Es un gasto" (the web's DirectionDialog): records the
 * movement the other way round and, if asked, the movements whose bank
 * text contains a pattern too (an automatic name keeps doing it). Mounted
 * while open.
 */
export function DirectionSheet({
  change,
  account,
  onClose,
  onChanged,
}: {
  change: DirectionChange;
  account: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const td = useTranslations('transaction.direction');
  const { t, locale } = useLocalizer();
  const gql = useGql();
  const [form, setForm] = React.useState<DirectionForm>(() => newDirectionForm(change));
  const [errors, setErrors] = React.useState<DirectionErrors>({});
  const [saving, setSaving] = React.useState(false);
  const income = change.to === 'income';
  const amount = formatMoney(change.amount, change.currency, locale);
  const update = (patch: Partial<DirectionForm>) => setForm((current) => ({ ...current, ...patch }));

  async function save() {
    const found = validateDirectionForm(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    try {
      const more = await changeDirection(buildDirectionInput(change, form), gql);
      const done = td(income ? 'doneIncome' : 'doneExpense');
      toast.success(more > 0 ? `${done}. ${td('doneMore', { count: more })}` : done);
      onChanged();
    } catch (error) {
      toast.error(requestErrorMessage(error, t));
      setSaving(false);
    }
  }

  return (
    <Sheet
      open
      onOpenChange={(next) => !next && !saving && onClose()}
      title={td(income ? 'titleIncome' : 'titleExpense')}
      description={`${td(income ? 'descriptionIncome' : 'descriptionExpense', { amount, account })} ${td('bankNote')}`}
      closeLabel={t('common.close')}
    >
      <TwView className="gap-4">
        <TwView className="flex-row items-center gap-3">
          <TwView className="flex-1 gap-0.5">
            <Text className="text-sm">{td('remember')}</Text>
            <Text className="text-xs text-on-surface-variant">{td(income ? 'rememberHintIncome' : 'rememberHintExpense')}</Text>
          </TwView>
          <Switch checked={form.remember} onCheckedChange={(remember) => update({ remember })} accessibilityLabel={td('remember')} />
        </TwView>
        {form.remember ? (
          <>
            <Input
              label={td('pattern')}
              value={form.pattern}
              maxLength={DIRECTION_PATTERN_MAX}
              autoCapitalize="characters"
              onChangeText={(pattern) => update({ pattern })}
              error={errors.pattern ? td(`errors.${errors.pattern}`) : undefined}
            />
            <Input
              label={td('name')}
              value={form.displayName}
              maxLength={DIRECTION_NAME_MAX}
              onChangeText={(displayName) => update({ displayName })}
              error={errors.displayName ? td(`errors.${errors.displayName}`) : undefined}
            />
          </>
        ) : null}
        <Button label={saving ? td('saving') : td('confirm')} onPress={() => void save()} disabled={saving} className="w-full" />
      </TwView>
    </Sheet>
  );
}
