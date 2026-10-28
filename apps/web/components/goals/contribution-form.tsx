'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { DatePicker } from '@finnit/ui/components/ui/date-picker';
import { Input } from '@finnit/ui/components/ui/input';

import { todayKey } from '@/lib/finance/dates';
import { addContribution, goalErrorMessage } from '@/lib/goals/api';
import {
  hasErrors,
  newContributionForm,
  validateContributionForm,
  type ContributionErrors,
  type ContributionForm as Form,
} from '@/lib/goals/form';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';

/** "Agregar aportación": amount and date, saved right away. */
export function ContributionForm({
  goalId,
  onAdded,
}: {
  goalId: string;
  onAdded: (amountText: string) => void;
}) {
  const { t } = useLocalizer();
  const tc = useTranslations('goals.contributions');
  const locale = useLocale();
  const today = todayKey();
  const [form, setForm] = React.useState<Form>(() =>
    newContributionForm(today),
  );
  const [errors, setErrors] = React.useState<ContributionErrors>({});
  const [saving, setSaving] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  function update(patch: Partial<Form>) {
    setForm((current) => ({ ...current, ...patch }));
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch)) delete next[key as keyof Form];
      return next;
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const found = validateContributionForm(form, today);
    setErrors(found);
    if (hasErrors(found)) return;
    setSaving(true);
    setSubmitError(null);
    try {
      await addContribution(goalId, form, gql);
      onAdded(form.amount);
      setForm(newContributionForm(today));
    } catch (error) {
      setSubmitError(goalErrorMessage(error, t));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-label={tc('add')}
      className="flex flex-col gap-3 rounded-input border border-outline/70 p-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label={tc('amount')}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={form.amount}
          onChange={(e) => update({ amount: e.target.value })}
          error={
            errors.amount ? t(`goals.validation.${errors.amount}`) : undefined
          }
        />
        <DatePicker
          label={tc('date')}
          value={form.date || undefined}
          onChange={(day) => update({ date: day ?? '' })}
          max={today}
          locale={locale}
          required
          error={errors.date ? t(`goals.validation.${errors.date}`) : undefined}
        />
      </div>
      {submitError ? (
        <p role="alert" className="text-[13px] text-expense">
          {submitError}
        </p>
      ) : null}
      <Button
        type="submit"
        variant="secondary"
        size="sm"
        disabled={saving}
        className="self-end"
      >
        <Plus aria-hidden /> {saving ? tc('adding') : tc('add')}
      </Button>
    </form>
  );
}
