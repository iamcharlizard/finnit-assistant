'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { Combobox } from '@finnit/ui/components/ui/combobox';
import { DatePicker } from '@finnit/ui/components/ui/date-picker';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@finnit/ui/components/ui/dialog';
import { Input } from '@finnit/ui/components/ui/input';
import { Label } from '@finnit/ui/components/ui/label';
import { Switch } from '@finnit/ui/components/ui/switch';
import { Textarea } from '@finnit/ui/components/ui/textarea';

import { todayKey } from '@/lib/finance/dates';
import type { ApiAccount } from '@/lib/finance/types';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import { accountOptions, categoryOptions } from '@/lib/new-entry/options';
import {
  recurringErrorMessage,
  saveRecurring,
  type SaveTarget,
} from '@/lib/recurring/api';
import {
  NAME_MAX,
  NOTES_MAX,
  PATTERN_MAX,
  formOfExpense,
  formOfSuggestion,
  hasErrors,
  newRecurringForm,
  validateRecurringForm,
  type FormErrorCode,
  type FormErrors,
  type RecurringForm,
} from '@/lib/recurring/form';
import {
  CURRENCIES,
  RECURRING_FREQUENCIES,
  RECURRING_KINDS,
  type ApiRecurringCategory,
  type ApiRecurringExpense,
  type ApiRecurringSuggestion,
} from '@/lib/recurring/types';
import { SelectField } from './select-field';
import { TrackingModeField } from './tracking-mode-field';

/** What the dialog opens on. */
export type ExpenseDialogSubject =
  | { mode: 'create' }
  | { mode: 'edit'; expense: ApiRecurringExpense }
  | { mode: 'suggestion'; suggestion: ApiRecurringSuggestion };

function startingPoint(
  subject: ExpenseDialogSubject,
  currency: string,
): { form: RecurringForm; target: SaveTarget } {
  if (subject.mode === 'edit') {
    const form = formOfExpense(subject.expense);
    return {
      form,
      target: { mode: 'edit', id: subject.expense.id, initial: form },
    };
  }
  if (subject.mode === 'suggestion') {
    const form = formOfSuggestion(subject.suggestion);
    return {
      form,
      target: {
        mode: 'suggestion',
        fingerprint: subject.suggestion.fingerprint,
        initial: form,
      },
    };
  }
  return {
    form: newRecurringForm({ today: todayKey(), currency }),
    target: { mode: 'create' },
  };
}

/**
 * Create, edit or accept-a-suggestion form for a recurring payment. Mounted
 * while open, so it starts from the subject's values.
 */
export function ExpenseDialog({
  subject,
  accounts,
  categories,
  defaultCurrency,
  onClose,
  onSaved,
}: {
  subject: ExpenseDialogSubject;
  accounts: ApiAccount[];
  categories: ApiRecurringCategory[];
  defaultCurrency: string;
  onClose: () => void;
  /** After saving; `changed` is false when an edit changed nothing. */
  onSaved: (changed: boolean, name: string) => void;
}) {
  const { t } = useLocalizer();
  const tf = useTranslations('recurring.form');
  const locale = useLocale();
  const [{ form: initialForm, target }] = React.useState(() =>
    startingPoint(subject, defaultCurrency),
  );
  const [form, setForm] = React.useState(initialForm);
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [saving, setSaving] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const accountItems = React.useMemo(
    () => accountOptions(accounts),
    [accounts],
  );
  const categoryItems = React.useMemo(
    () => categoryOptions(categories, 'expense', locale),
    [categories, locale],
  );
  const errorText = (code: FormErrorCode | undefined) =>
    code ? t(`recurring.validation.${code}`) : undefined;

  function update(patch: Partial<RecurringForm>) {
    setForm((current) => ({ ...current, ...patch }));
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch)) {
        delete next[key as keyof RecurringForm];
      }
      if ('startDate' in patch) delete next.endDate;
      if ('installmentsTotal' in patch) delete next.installmentsPaid;
      return next;
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const found = validateRecurringForm(form);
    setErrors(found);
    if (hasErrors(found)) return;
    setSaving(true);
    setSubmitError(null);
    try {
      const changed = await saveRecurring(form, target, gql);
      onSaved(changed, form.name.trim());
    } catch (error) {
      setSubmitError(recurringErrorMessage(error, t));
      setSaving(false);
    }
  }

  const isInstallment = form.kind === 'installment';
  const title =
    subject.mode === 'edit'
      ? tf('editTitle')
      : subject.mode === 'suggestion'
        ? tf('suggestionTitle')
        : tf('createTitle');
  const description =
    subject.mode === 'edit'
      ? tf('editDescription', { name: subject.expense.name })
      : subject.mode === 'suggestion'
        ? tf('suggestionDescription')
        : tf('createDescription');
  const submitLabel =
    subject.mode === 'edit'
      ? tf('save')
      : subject.mode === 'suggestion'
        ? tf('accept')
        : tf('create');

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent
        closeLabel={t('common.close')}
        className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl"
      >
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          {subject.mode === 'suggestion' ? (
            <p className="flex items-center gap-2 rounded-input bg-accent-neon/10 p-3 text-xs text-on-background">
              <Sparkles
                aria-hidden
                className="size-4 shrink-0 text-violet-ink"
              />
              {tf('suggestionNote', { merchant: subject.suggestion.merchant })}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={tf('name')}
              value={form.name}
              maxLength={NAME_MAX}
              autoComplete="off"
              placeholder={tf('namePlaceholder')}
              onChange={(e) => update({ name: e.target.value })}
              error={errorText(errors.name)}
            />
            <SelectField
              label={tf('kind')}
              value={form.kind}
              options={RECURRING_KINDS.map((kind) => ({
                value: kind,
                label: t(`finance.recurringKinds.${kind}`),
              }))}
              onChange={(kind) => update({ kind })}
            />
          </div>

          <TrackingModeField
            value={form.trackingMode}
            onChange={(trackingMode) => update({ trackingMode })}
          />

          <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <SelectField
              label={tf('frequency')}
              value={form.frequency}
              options={RECURRING_FREQUENCIES.map((frequency) => ({
                value: frequency,
                label: t(`recurring.frequencies.${frequency}`),
              }))}
              onChange={(frequency) => update({ frequency })}
            />
            <div className="flex flex-col gap-1">
              <Input
                label={tf('interval')}
                inputMode="numeric"
                value={form.interval}
                maxLength={2}
                onChange={(e) =>
                  update({ interval: e.target.value.replace(/\D/g, '') })
                }
                error={errorText(errors.interval)}
              />
              <p className="px-1 text-xs text-on-surface-variant">
                {tf('intervalHint')}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <DatePicker
                label={tf('startDate')}
                value={form.startDate || undefined}
                onChange={(day) => update({ startDate: day ?? '' })}
                locale={locale}
                placeholder={tf('datePlaceholder')}
                required
                error={errorText(errors.startDate)}
              />
              <p className="px-1 text-xs text-on-surface-variant">
                {tf('startDateHint')}
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <DatePicker
                label={tf('endDate')}
                value={form.endDate || undefined}
                onChange={(day) => update({ endDate: day ?? '' })}
                min={form.startDate || undefined}
                locale={locale}
                placeholder={tf('endDatePlaceholder')}
                error={errorText(errors.endDate)}
              />
              {form.endDate ? (
                <button
                  type="button"
                  onClick={() => update({ endDate: '' })}
                  className="self-start px-1 text-xs font-medium text-income hover:underline"
                >
                  {tf('clearEndDate')}
                </button>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Input
              label={tf('amount')}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => update({ amount: e.target.value })}
              error={errorText(errors.amount)}
            />
            <SelectField
              label={tf('currency')}
              value={form.currency}
              options={[...new Set<string>([...CURRENCIES, form.currency])].map(
                (currency) => ({ value: currency, label: currency }),
              )}
              onChange={(currency) => update({ currency })}
              disabled={subject.mode !== 'create'}
              hint={subject.mode === 'edit' ? tf('currencyFixed') : undefined}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <Label
                htmlFor="recurring-variable"
                className="text-sm normal-case tracking-normal text-on-background"
              >
                {tf('variable')}
              </Label>
              <p className="text-xs text-on-surface-variant">
                {tf('variableHint')}
              </p>
            </div>
            <Switch
              id="recurring-variable"
              checked={form.isVariableAmount}
              onCheckedChange={(isVariableAmount) =>
                update({ isVariableAmount })
              }
            />
          </div>

          {isInstallment ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label={tf('installmentsTotal')}
                inputMode="numeric"
                maxLength={3}
                value={form.installmentsTotal}
                onChange={(e) =>
                  update({
                    installmentsTotal: e.target.value.replace(/\D/g, ''),
                  })
                }
                error={errorText(errors.installmentsTotal)}
              />
              <Input
                label={tf('installmentsPaid')}
                inputMode="numeric"
                maxLength={3}
                value={form.installmentsPaid}
                onChange={(e) =>
                  update({
                    installmentsPaid: e.target.value.replace(/\D/g, ''),
                  })
                }
                error={errorText(errors.installmentsPaid)}
              />
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Combobox
              label={tf('account')}
              options={accountItems}
              value={form.accountId || undefined}
              onChange={(accountId) => update({ accountId: accountId ?? '' })}
              placeholder={tf('accountPlaceholder')}
              searchPlaceholder={tf('accountSearch')}
              emptyText={tf('noResults')}
              clearable
            />
            <Combobox
              label={tf('category')}
              options={categoryItems}
              value={form.categoryId || undefined}
              onChange={(categoryId) =>
                update({ categoryId: categoryId ?? '' })
              }
              placeholder={tf('categoryPlaceholder')}
              searchPlaceholder={tf('categorySearch')}
              emptyText={tf('noResults')}
              clearable
            />
          </div>

          <div className="flex flex-col gap-1">
            <Input
              label={tf('merchantPattern')}
              value={form.merchantPattern}
              maxLength={PATTERN_MAX}
              autoComplete="off"
              placeholder={tf('merchantPatternPlaceholder')}
              onChange={(e) => update({ merchantPattern: e.target.value })}
              error={errorText(errors.merchantPattern)}
            />
            <p className="px-1 text-xs text-on-surface-variant">
              {tf('merchantPatternHint')}
            </p>
          </div>

          <Textarea
            label={tf('notes')}
            placeholder={tf('notesPlaceholder')}
            value={form.notes}
            onChange={(e) => update({ notes: e.target.value })}
            rows={2}
            maxLength={NOTES_MAX}
            error={errorText(errors.notes)}
          />

          {hasErrors(errors) ? (
            <p role="alert" className="text-[13px] text-expense">
              {tf('fixErrors')}
            </p>
          ) : null}
          {submitError ? (
            <p role="alert" className="text-[13px] text-expense">
              {submitError}
            </p>
          ) : null}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={saving}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" variant="secondary" disabled={saving}>
              {saving ? tf('saving') : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
