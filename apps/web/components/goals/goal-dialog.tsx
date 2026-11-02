'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { Button } from '@finnit/ui/components/ui/button';
import { DatePicker } from '@finnit/ui/components/ui/date-picker';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@finnit/ui/components/ui/dialog';
import { useDialogExit } from '@finnit/ui/lib/use-dialog-exit';
import { Input } from '@finnit/ui/components/ui/input';
import { MoneyInput } from '@finnit/ui/components/ui/money-input';

import { SelectField } from '@/components/recurring/select-field';
import { todayKey } from '@/lib/finance/dates';
import {
  goalErrorMessage,
  saveGoal,
  type GoalSaveTarget,
} from '@/lib/goals/api';
import {
  NAME_MAX,
  formOfGoal,
  hasErrors,
  newGoalForm,
  validateGoalForm,
  type GoalForm,
  type GoalFormErrorCode,
  type GoalFormErrors,
} from '@/lib/goals/form';
import type { ApiGoal } from '@/lib/goals/types';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import { CURRENCIES } from '@/lib/recurring/types';

export type GoalDialogSubject =
  | { mode: 'create' }
  | { mode: 'edit'; goal: ApiGoal };

export interface GoalSaved {
  changed: boolean;
  name: string;
  goalId: string | null;
  /** Message when the goal was created but its starting amount wasn't saved. */
  initialError: string | null;
}

/** Create or edit a goal. Mounted while open, so it starts from the subject. */
export function GoalDialog({
  subject,
  defaultCurrency,
  onClose,
  onSaved,
}: {
  subject: GoalDialogSubject;
  defaultCurrency: string;
  onClose: () => void;
  onSaved: (result: GoalSaved) => void;
}) {
  // Closes with the exit animation before telling the parent.
  const exit = useDialogExit();
  const { t } = useLocalizer();
  const tf = useTranslations('goals.form');
  const locale = useLocale();
  const [{ initial, target }] = React.useState<{
    initial: GoalForm;
    target: GoalSaveTarget;
  }>(() => {
    if (subject.mode === 'edit') {
      const form = formOfGoal(subject.goal);
      return {
        initial: form,
        target: { mode: 'edit', id: subject.goal.id, initial: form },
      };
    }
    return {
      initial: newGoalForm(defaultCurrency),
      target: { mode: 'create' },
    };
  });
  const [form, setForm] = React.useState(initial);
  const [errors, setErrors] = React.useState<GoalFormErrors>({});
  const [saving, setSaving] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const today = todayKey();
  const editing = subject.mode === 'edit';

  const errorText = (code: GoalFormErrorCode | undefined) =>
    code ? t(`goals.validation.${code}`) : undefined;

  function update(patch: Partial<GoalForm>) {
    setForm((current) => ({ ...current, ...patch }));
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch)) delete next[key as keyof GoalForm];
      return next;
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const found = validateGoalForm(form, {
      today,
      initial: editing ? initial : undefined,
    });
    setErrors(found);
    if (hasErrors(found)) return;
    setSaving(true);
    setSubmitError(null);
    try {
      const result = await saveGoal(form, target, gql, today);
      exit.after(onSaved)({
        changed: result.changed,
        name: form.name.trim(),
        goalId: result.goalId,
        initialError: result.initialFailed
          ? goalErrorMessage(result.initialFailed, t)
          : null,
      });
    } catch (error) {
      setSubmitError(goalErrorMessage(error, t));
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={exit.open}
      onOpenChange={(open) => !open && !saving && exit.close(onClose)}
    >
      <DialogContent
        onExitComplete={exit.onExitComplete}
        closeLabel={t('common.close')}
        className="sm:max-w-lg"
      >
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>
              {editing ? tf('editTitle') : tf('createTitle')}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? tf('editDescription', { name: subject.goal.name })
                : tf('createDescription')}
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <Input
              label={tf('name')}
              value={form.name}
              maxLength={NAME_MAX}
              autoComplete="off"
              placeholder={tf('namePlaceholder')}
              onChange={(e) => update({ name: e.target.value })}
              error={errorText(errors.name)}
            />

            <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <MoneyInput
                label={tf('target')}
                value={form.targetAmount}
                onValueChange={(value) => update({ targetAmount: value })}
                error={errorText(errors.targetAmount)}
              />
              <SelectField
                label={tf('currency')}
                value={form.currency}
                options={[
                  ...new Set<string>([...CURRENCIES, form.currency]),
                ].map((currency) => ({ value: currency, label: currency }))}
                onChange={(currency) => update({ currency })}
                disabled={editing}
                hint={editing ? tf('currencyFixed') : undefined}
              />
            </div>

            <div className="flex flex-col gap-1">
              <DatePicker
                label={tf('dueDate')}
                value={form.dueDate || undefined}
                onChange={(day) => update({ dueDate: day ?? '' })}
                min={today}
                locale={locale}
                placeholder={tf('dueDatePlaceholder')}
                error={errorText(errors.dueDate)}
              />
              {form.dueDate ? (
                <button
                  type="button"
                  onClick={() => update({ dueDate: '' })}
                  className="self-start px-1 text-xs font-medium text-income hover:underline"
                >
                  {tf('clearDueDate')}
                </button>
              ) : (
                <p className="px-1 text-xs text-on-surface-variant">
                  {tf('dueDateHint')}
                </p>
              )}
            </div>

            {!editing ? (
              <div className="flex flex-col gap-1">
                <MoneyInput
                  label={tf('initialAmount')}
                  value={form.initialAmount}
                  onValueChange={(value) => update({ initialAmount: value })}
                  error={errorText(errors.initialAmount)}
                />
                <p className="px-1 text-xs text-on-surface-variant">
                  {tf('initialAmountHint')}
                </p>
              </div>
            ) : null}

            {submitError ? (
              <p role="alert" className="text-[13px] text-expense">
                {submitError}
              </p>
            ) : null}
          </DialogBody>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={saving}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" variant="secondary" disabled={saving}>
              {saving ? tf('saving') : editing ? tf('save') : tf('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
