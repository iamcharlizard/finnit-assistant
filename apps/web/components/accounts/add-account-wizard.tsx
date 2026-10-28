'use client';

import * as React from 'react';
import { CircleCheck } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@finnit/ui/components/ui/dialog';

import { accountErrorMessage, createManualAccount } from '@/lib/accounts/api';
import {
  WIZARD_STEPS,
  bankNameOf,
  deriveAccountName,
  emptyManualAccountForm,
  openingBalance,
  uniqueAccountName,
  validateWizard,
  validateWizardStep,
  type ErrorCode,
  type FormErrors,
  type ManualAccountForm,
  type WizardStep,
} from '@/lib/accounts/form';
import { cardPreview } from '@/lib/accounts/view';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import { WizardDesignStep } from './wizard-design-step';
import { WizardDetailsStep } from './wizard-details-step';
import { WizardMoneyStep } from './wizard-money-step';
import { WizardProgress } from './wizard-progress';
import { WizardTypeStep } from './wizard-type-step';

/**
 * "Agregar cuenta": a manual debit, credit, cash or savings account in four
 * steps. Mounted while open, so every opening starts empty.
 */
export function AddAccountWizard({
  existingNames,
  holderName,
  onClose,
  onCreated,
}: {
  existingNames: ReadonlyArray<string>;
  holderName: string;
  onClose: () => void;
  onCreated: (accountId: string) => void;
}) {
  const l = useLocalizer();
  const { t } = l;
  const [form, setForm] = React.useState<ManualAccountForm>(
    emptyManualAccountForm,
  );
  const [step, setStep] = React.useState<WizardStep>('type');
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [saving, setSaving] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [partial, setPartial] = React.useState<{
    id: string;
    name: string;
    message: string;
  } | null>(null);

  const index = WIZARD_STEPS.indexOf(step);
  const isLast = index === WIZARD_STEPS.length - 1;
  const typeLabel = form.type ? t(`finance.accountTypes.${form.type}`) : '';
  const name = form.type
    ? uniqueAccountName(deriveAccountName(form, typeLabel), existingNames)
    : '';
  const errorText = (code: ErrorCode | undefined) =>
    code ? t(`accounts.errors.${code}`) : undefined;
  const fieldErrors = Object.fromEntries(
    Object.entries(errors).map(([field, code]) => [field, errorText(code)]),
  );

  function update(patch: Partial<ManualAccountForm>) {
    setForm((current) => ({ ...current, ...patch }));
    // Clear the messages of the fields being edited.
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch)) delete next[key];
      if ('bankChoice' in patch || 'bankOther' in patch) delete next.bank;
      return next;
    });
  }

  function next() {
    const found = validateWizardStep(form, step);
    setErrors(found);
    if (Object.keys(found).length) return;
    setStep(WIZARD_STEPS[index + 1]!);
  }

  function back() {
    setErrors({});
    setSubmitError(null);
    setStep(WIZARD_STEPS[Math.max(0, index - 1)]!);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!isLast) {
      next();
      return;
    }
    const { errors: found, firstInvalidStep } = validateWizard(form);
    setErrors(found);
    if (firstInvalidStep) {
      setStep(firstInvalidStep);
      return;
    }

    setSaving(true);
    setSubmitError(null);
    try {
      const created = await createManualAccount(form, {
        baseName: deriveAccountName(form, typeLabel),
        existingNames,
        run: gql,
      });
      if (created.termsSaved) {
        onCreated(created.id);
      } else {
        setPartial({
          id: created.id,
          name: form.nickname.trim() || created.name,
          message: t('accounts.wizard.termsFailed', {
            error: accountErrorMessage(created.termsError, t),
          }),
        });
      }
    } catch (error) {
      setSubmitError(accountErrorMessage(error, t));
    } finally {
      setSaving(false);
    }
  }

  const preview = cardPreview(
    {
      type: form.type ?? 'debit',
      label: form.nickname.trim() || name,
      bankName: bankNameOf(form) ?? (form.nickname.trim() || name),
      last4: form.last4 || null,
      balance: openingBalance(form),
      currency: form.currency,
    },
    l,
  );

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent closeLabel={t('common.close')} className="sm:max-w-xl">
        {partial ? (
          <>
            <DialogHeader>
              <CircleCheck aria-hidden className="mb-1 size-8 text-income" />
              <DialogTitle>
                {t('accounts.wizard.doneTitle', { name: partial.name })}
              </DialogTitle>
              <DialogDescription role="alert">
                {partial.message}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="secondary" onClick={() => onCreated(partial.id)}>
                {t('accounts.wizard.viewAccount')}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} noValidate className="flex flex-col gap-5">
            <DialogHeader>
              <DialogTitle>{t('accounts.wizard.title')}</DialogTitle>
              <DialogDescription>
                {t('accounts.wizard.description')}
              </DialogDescription>
            </DialogHeader>
            <WizardProgress step={step} />

            {step === 'type' ? (
              <WizardTypeStep
                value={form.type}
                onChange={(type) => update({ type })}
                error={fieldErrors.type}
              />
            ) : null}
            {step === 'details' ? (
              <WizardDetailsStep
                form={form}
                onChange={update}
                errors={fieldErrors}
              />
            ) : null}
            {step === 'money' ? (
              <WizardMoneyStep
                form={form}
                onChange={update}
                errors={fieldErrors}
              />
            ) : null}
            {step === 'design' ? (
              <>
                <WizardDesignStep
                  preview={preview}
                  design={form.design}
                  onChange={(design) => update({ design })}
                  holderName={holderName}
                  intro={t('accounts.wizard.designIntro')}
                />
                <p className="text-xs text-on-surface-variant">
                  {t('accounts.wizard.nameNote', { name })}
                </p>
              </>
            ) : null}

            {submitError ? (
              <p role="alert" className="text-[13px] text-expense">
                {submitError}
              </p>
            ) : null}

            <DialogFooter>
              {index > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={back}
                  disabled={saving}
                >
                  {t('accounts.wizard.back')}
                </Button>
              ) : (
                <Button type="button" variant="outline" onClick={onClose}>
                  {t('common.cancel')}
                </Button>
              )}
              <Button type="submit" variant="secondary" disabled={saving}>
                {isLast
                  ? saving
                    ? t('accounts.wizard.creating')
                    : t('accounts.wizard.create')
                  : t('accounts.wizard.next')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
