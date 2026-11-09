'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@finnit/ui/components/ui/button';
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

import {
  debtErrorMessage,
  saveDebt,
  type DebtTarget,
} from '@finnit/core/debts/api';
import {
  formOfDebt,
  hasErrors,
  newDebtForm,
  validateDebtForm,
  type DebtForm,
  type DebtFormErrors,
} from '@finnit/core/debts/form';
import type { ApiDebt } from '@finnit/core/debts/types';
import { OtherDebtFields } from './other-debt-fields';
import type { ApiAccount } from '@finnit/core/finance/types';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';

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
            <OtherDebtFields
              form={form}
              errors={errors}
              update={update}
              accounts={accounts}
              keepAccountId={debt?.linkedAccountId ?? null}
              showKind
              locked={locked}
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
