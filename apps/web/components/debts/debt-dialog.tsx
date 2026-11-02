'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { Button } from '@finnit/ui/components/ui/button';
import { Combobox } from '@finnit/ui/components/ui/combobox';
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
import { NumberInput } from '@finnit/ui/components/ui/number-input';
import { MoneyInput } from '@finnit/ui/components/ui/money-input';

import { SelectField } from '@/components/recurring/select-field';
import { debtErrorMessage, saveDebt, type DebtTarget } from '@/lib/debts/api';
import {
  NAME_MAX,
  formOfDebt,
  hasErrors,
  newDebtForm,
  validateDebtForm,
  type DebtErrorCode,
  type DebtForm,
  type DebtFormErrors,
} from '@/lib/debts/form';
import { DEBT_KINDS, type ApiDebt } from '@/lib/debts/types';
import type { ApiAccount } from '@/lib/finance/types';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import { accountOptions } from '@/lib/new-entry/options';

/**
 * Create or edit a debt. Mounted while open, so it starts from the debt's
 * values. The principal can't go below what has been paid.
 */
export function DebtDialog({
  debt,
  accounts,
  onClose,
  onSaved,
}: {
  /** null = a new debt. */
  debt: ApiDebt | null;
  accounts: ApiAccount[];
  onClose: () => void;
  /** `changed` is false when an edit changed nothing. */
  onSaved: (changed: boolean, name: string) => void;
}) {
  // Closes with the exit animation before telling the parent.
  const exit = useDialogExit();
  const { t } = useLocalizer();
  const tf = useTranslations('debts.form');
  const locale = useLocale();
  const [{ initial, target }] = React.useState(() => {
    if (!debt) {
      return {
        initial: newDebtForm(),
        target: { mode: 'create' } as DebtTarget,
      };
    }
    const form = formOfDebt(debt);
    return {
      initial: form,
      target: { mode: 'edit', id: debt.id, initial: form } as DebtTarget,
    };
  });
  const [form, setForm] = React.useState<DebtForm>(initial);
  const [errors, setErrors] = React.useState<DebtFormErrors>({});
  const [saving, setSaving] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const accountItems = React.useMemo(
    () =>
      accountOptions(
        accounts,
        // Keep the linked account listed even if it was archived.
        (a) => !a.archived || a.id === debt?.linkedAccountId,
      ),
    [accounts, debt?.linkedAccountId],
  );
  const errorText = (code: DebtErrorCode | undefined) =>
    code ? t(`debts.validation.${code}`) : undefined;

  function update(patch: Partial<DebtForm>) {
    setForm((current) => ({ ...current, ...patch }));
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch)) delete next[key as keyof DebtForm];
      if ('startDate' in patch) delete next.dueDate;
      return next;
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const found = validateDebtForm(form, { paid: debt?.totalPaid ?? 0 });
    setErrors(found);
    if (hasErrors(found)) return;
    setSaving(true);
    setSubmitError(null);
    try {
      const changed = await saveDebt(form, target, gql);
      exit.after(onSaved)(changed, form.name.trim());
    } catch (error) {
      setSubmitError(debtErrorMessage(error, t));
      setSaving(false);
    }
  }

  const linked = accounts.find((a) => a.id === form.linkedAccountId);
  // A loan with terms keeps them; only its name, dates and account change.
  const locked = debt?.totalToRepay != null;

  return (
    <Dialog
      open={exit.open}
      onOpenChange={(open) => !open && !saving && exit.close(onClose)}
    >
      <DialogContent
        onExitComplete={exit.onExitComplete}
        closeLabel={t('common.close')}
        className="sm:max-w-2xl"
      >
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>
              {debt ? tf('editTitle') : tf('createTitle')}
            </DialogTitle>
            <DialogDescription>
              {debt
                ? tf('editDescription', { name: debt.name })
                : tf('createDescription')}
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
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
                disabled={locked}
                value={form.kind}
                options={DEBT_KINDS.map((kind) => ({
                  value: kind,
                  label: t(`debts.kinds.${kind}`),
                }))}
                onChange={(kind) => update({ kind })}
              />
            </div>

            {locked ? (
              <p className="rounded-input bg-track/60 p-3 text-xs text-on-background">
                {tf('lockedTerms')}
              </p>
            ) : null}
            <div className={locked ? 'hidden' : 'flex flex-col gap-1'}>
              <MoneyInput
                label={tf('principal')}
                value={form.principal}
                onValueChange={(value) => update({ principal: value })}
                error={errorText(errors.principal)}
              />
              <p className="px-1 text-xs text-on-surface-variant">
                {tf('principalHint')}
              </p>
            </div>

            <div className={locked ? 'hidden' : 'grid gap-4 sm:grid-cols-2'}>
              <NumberInput
                decimals={4}
                suffix="%"
                label={tf('rate')}
                placeholder={tf('ratePlaceholder')}
                value={form.rate}
                onValueChange={(value) => update({ rate: value })}
                error={errorText(errors.rate)}
              />
              <MoneyInput
                label={tf('minPayment')}
                value={form.minPayment}
                onValueChange={(value) => update({ minPayment: value })}
                error={errorText(errors.minPayment)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <DatePicker
                label={tf('startDate')}
                value={form.startDate || undefined}
                onChange={(day) => update({ startDate: day ?? '' })}
                locale={locale}
                placeholder={tf('datePlaceholder')}
              />
              <div className="flex flex-col gap-1">
                <DatePicker
                  label={tf('dueDate')}
                  value={form.dueDate || undefined}
                  onChange={(day) => update({ dueDate: day ?? '' })}
                  min={form.startDate || undefined}
                  locale={locale}
                  placeholder={tf('datePlaceholder')}
                  error={errorText(errors.dueDate)}
                />
                {form.dueDate ? (
                  <button
                    type="button"
                    onClick={() => update({ dueDate: '' })}
                    className="self-start px-1 text-xs font-medium text-income hover:underline"
                  >
                    {tf('clearDate')}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <Combobox
                label={tf('account')}
                options={accountItems}
                value={form.linkedAccountId || undefined}
                onChange={(linkedAccountId) =>
                  update({ linkedAccountId: linkedAccountId ?? '' })
                }
                placeholder={tf('accountPlaceholder')}
                searchPlaceholder={tf('accountSearch')}
                emptyText={tf('noResults')}
                clearable
              />
              <p className="px-1 text-xs text-on-surface-variant">
                {linked?.type === 'credit'
                  ? tf('accountCardHint')
                  : tf('accountHint')}
              </p>
            </div>

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
          </DialogBody>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={saving}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" variant="secondary" disabled={saving}>
              {saving ? tf('saving') : debt ? tf('save') : tf('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
