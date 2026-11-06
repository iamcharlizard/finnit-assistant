import * as React from 'react';
import { useTranslations } from 'use-intl';

import { todayKey } from '@finnit/core/finance/dates';
import { goalErrorMessage, saveGoal, type GoalSaveResult, type GoalSaveTarget } from '@finnit/core/goals/api';
import { NAME_MAX, hasErrors, validateGoalForm, type GoalForm, type GoalFormErrors } from '@finnit/core/goals/form';
import { TwScrollView, TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { DatePicker } from '@finnit/ui-native/components/ui/date-picker';
import { Input } from '@finnit/ui-native/components/ui/input';
import { MoneyInput } from '@finnit/ui-native/components/ui/money-input';
import { Sheet } from '@finnit/ui-native/components/ui/sheet';
import { Text } from '@finnit/ui-native/components/ui/text';

import { useGql } from '@/lib/graphql/runner';
import { useLocalizer } from '@/lib/i18n/i18n-provider';

/** Creating or editing a goal: name, target, optional deadline and (new) what's already saved. */
export function GoalSheet({
  target,
  initial,
  onClose,
  onSaved,
}: {
  target: GoalSaveTarget;
  initial: GoalForm;
  onClose: () => void;
  onSaved: (result: GoalSaveResult, name: string) => void;
}) {
  const t = useTranslations();
  const tf = useTranslations('goals.form');
  const l = useLocalizer();
  const gql = useGql();
  const today = todayKey();
  const [form, setForm] = React.useState(initial);
  const [errors, setErrors] = React.useState<GoalFormErrors>({});
  const [saving, setSaving] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const isEdit = target.mode === 'edit';
  const update = (patch: Partial<GoalForm>) => setForm((f) => ({ ...f, ...patch }));
  const err = (code?: string) => (code ? t(`goals.validation.${code}` as 'goals.validation.nameRequired') : undefined);

  async function submit() {
    const found = validateGoalForm(form, { today, initial: target.mode === 'edit' ? target.initial : undefined });
    setErrors(found);
    if (hasErrors(found)) return;
    setSaving(true);
    setSubmitError(null);
    try {
      const result = await saveGoal(form, target, gql, today);
      onSaved(result, form.name.trim());
    } catch (error) {
      setSubmitError(goalErrorMessage(error, l.t));
      setSaving(false);
    }
  }

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && !saving && onClose()}
      title={isEdit ? tf('editTitle') : tf('createTitle')}
      description={isEdit ? tf('editDescription', { name: initial.name }) : tf('createDescription')}
      closeLabel={t('common.close')}
    >
      <TwScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 560 }} contentContainerClassName="gap-4 pb-2">
        <Input label={tf('name')} placeholder={tf('namePlaceholder')} value={form.name} onChangeText={(name) => update({ name })} maxLength={NAME_MAX} error={err(errors.name)} />
        <MoneyInput label={tf('target')} value={form.targetAmount} onValueChange={(targetAmount) => update({ targetAmount })} currency={form.currency} error={err(errors.targetAmount)} />
        <TwView className="gap-1">
          <DatePicker
            label={tf('dueDate')}
            locale={l.locale}
            value={form.dueDate || undefined}
            min={today}
            placeholder={tf('dueDatePlaceholder')}
            clearable
            clearLabel={tf('clearDueDate')}
            onChange={(day) => update({ dueDate: day ?? '' })}
            error={err(errors.dueDate)}
            closeLabel={t('common.close')}
          />
          <Text className="px-1 text-xs text-on-surface-variant">{tf('dueDateHint')}</Text>
        </TwView>
        {!isEdit ? (
          <TwView className="gap-1">
            <MoneyInput label={tf('initialAmount')} value={form.initialAmount} onValueChange={(initialAmount) => update({ initialAmount })} currency={form.currency} error={err(errors.initialAmount)} />
            <Text className="px-1 text-xs text-on-surface-variant">{tf('initialAmountHint')}</Text>
          </TwView>
        ) : null}
        {submitError ? (
          <Text accessibilityRole="alert" className="text-[13px] text-expense">
            {submitError}
          </Text>
        ) : null}
        <Button variant="secondary" label={saving ? tf('saving') : isEdit ? tf('save') : tf('create')} onPress={submit} disabled={saving} className="w-full" />
      </TwScrollView>
    </Sheet>
  );
}
