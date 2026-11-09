'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@finnit/ui/components/ui/button';
import {
  Dialog,
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
import { Label } from '@finnit/ui/components/ui/label';
import { Switch } from '@finnit/ui/components/ui/switch';

import {
  accountErrorMessage,
  saveAccountChanges,
  setAccountInTotal,
} from '@finnit/core/accounts/api';
import { bankChoiceOf } from '@finnit/core/accounts/banks';
import {
  NICKNAME_MAX_LENGTH,
  buildMetadataPatch,
  buildTermsChange,
  editFormOf,
  validateEdit,
  type AccountEditForm,
  type ErrorCode,
  type FormErrors,
} from '@finnit/core/accounts/form';
import { cardPreview, type AccountSummary } from '@finnit/core/accounts/view';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import { ArchiveAccountButton } from './archive-account-button';
import { BankField } from './bank-field';
import { CreditTermsFields } from './credit-terms-fields';
import { WizardDesignStep } from './wizard-design-step';

/**
 * Nickname, design, bank details (manual accounts only), credit terms and
 * archive. Mounted while open, so it starts from the saved values.
 */
export function EditAccountDialog({
  account,
  holderName,
  onClose,
  onSaved,
}: {
  account: AccountSummary;
  holderName: string;
  onClose: () => void;
  /** After saving or (un)archiving: refresh the data. */
  onSaved: (change?: { archived: boolean }) => void;
}) {
  // Closes with the exit animation before telling the parent.
  const exit = useDialogExit();
  const l = useLocalizer();
  const { t } = l;
  const tw = useTranslations('accounts.wizard');
  const initial = account.edit;
  const [form, setForm] = React.useState<AccountEditForm>(() =>
    editFormOf(initial, bankChoiceOf(initial.bank)),
  );
  const [errors, setErrors] = React.useState<FormErrors>({});
  const initialInTotal = initial.includeInTotal !== false;
  const [inTotal, setInTotal] = React.useState(initialInTotal);
  const [saving, setSaving] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const editableBank = !initial.linked && initial.type !== 'cash';
  const isCredit = initial.type === 'credit';
  const errorText = (code: ErrorCode | undefined) =>
    code ? t(`accounts.errors.${code}`) : undefined;

  function update(patch: Partial<AccountEditForm>) {
    setForm((current) => ({ ...current, ...patch }));
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch)) delete next[key];
      if ('bankChoice' in patch || 'bankOther' in patch) delete next.bank;
      return next;
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const found = validateEdit(form, initial);
    setErrors(found);
    if (Object.keys(found).length) return;

    const metadata = buildMetadataPatch(form, initial);
    const terms = buildTermsChange(form, initial);
    const totalChanged = inTotal !== initialInTotal;
    if (!metadata && !terms && !totalChanged) {
      exit.close(onClose);
      return;
    }
    setSaving(true);
    setSubmitError(null);
    try {
      if (totalChanged) await setAccountInTotal(account.id, inTotal, gql);
      if (metadata || terms) {
        await saveAccountChanges(account.id, { metadata, terms }, gql);
      }
      exit.after(onSaved)();
    } catch (error) {
      setSubmitError(accountErrorMessage(error, t));
    } finally {
      setSaving(false);
    }
  }

  const nickname = form.nickname.trim();
  const preview = {
    ...cardPreview(
      {
        type: account.type,
        label: nickname || account.name,
        nickname: nickname || null,
        bankName: account.bankName ?? (nickname || account.name),
        last4: account.last4,
        balance: 0,
        currency: account.currency,
      },
      l,
    ),
    // The account's own look and balance text, as in the list.
    balance: account.balance,
    variant: account.variant,
  };

  return (
    <Dialog
      open={exit.open}
      onOpenChange={(open) => !open && !saving && exit.close(onClose)}
    >
      <DialogContent
        onExitComplete={exit.onExitComplete}
        closeLabel={t('common.close')}
        className="sm:max-w-xl"
      >
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{t('accounts.editDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('accounts.editDialog.description', { name: account.label })}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1">
            <Input
              label={tw('nickname')}
              value={form.nickname}
              maxLength={NICKNAME_MAX_LENGTH}
              autoComplete="off"
              placeholder={tw('nicknamePlaceholder')}
              onChange={(e) => update({ nickname: e.target.value })}
              error={errorText(errors.nickname)}
            />
            <p className="px-1 text-xs text-on-surface-variant">
              {t('accounts.editDialog.originalName', { name: account.name })}
            </p>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <Label
                htmlFor="edit-account-in-total"
                className="normal-case tracking-normal text-sm text-on-background"
              >
                {t('accounts.inTotal.label')}
              </Label>
              <p className="text-xs text-on-surface-variant">
                {t('accounts.inTotal.hint')}
              </p>
            </div>
            <Switch
              id="edit-account-in-total"
              checked={inTotal}
              onCheckedChange={setInTotal}
              disabled={saving}
            />
          </div>

          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-medium text-on-background">
              {t('accounts.design.title')}
            </h3>
            <WizardDesignStep
              preview={preview}
              design={form.design}
              onChange={(design) => update({ design })}
              holderName={holderName}
            />
          </section>

          {initial.type !== 'cash' ? (
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-medium text-on-background">
                {t('accounts.editDialog.accountData')}
              </h3>
              {editableBank ? (
                <>
                  <BankField
                    choice={form.bankChoice}
                    other={form.bankOther}
                    optional
                    onChange={({ choice, other }) =>
                      update({ bankChoice: choice, bankOther: other })
                    }
                    error={errorText(errors.bank)}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <NumberInput
                      label={tw('last4')}
                      maxDigits={4}
                      value={form.last4}
                      placeholder={tw('last4Placeholder')}
                      onValueChange={(value) => update({ last4: value })}
                      error={errorText(errors.last4)}
                    />
                    {isCredit ? (
                      <MoneyInput
                        label={tw('creditLimit')}
                        currency={account.currency}
                        value={form.creditLimit}
                        onValueChange={(value) =>
                          update({ creditLimit: value })
                        }
                        error={errorText(errors.creditLimit)}
                      />
                    ) : null}
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-1 rounded-input bg-track p-3 text-sm text-on-surface-variant">
                  <p>{t('accounts.editDialog.linkedNote')}</p>
                  {account.bankName ? (
                    <p className="text-on-background">
                      {t('accounts.editDialog.readOnlyBank', {
                        bank: account.bankName,
                      })}
                    </p>
                  ) : null}
                  {account.last4 ? (
                    <p className="text-on-background">
                      {t('accounts.editDialog.readOnlyLast4', {
                        last4: account.last4,
                      })}
                    </p>
                  ) : null}
                </div>
              )}
            </section>
          ) : null}

          {isCredit ? (
            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <Label
                    htmlFor="edit-account-terms"
                    className="normal-case tracking-normal text-sm text-on-background"
                  >
                    {t('accounts.editDialog.hasTerms')}
                  </Label>
                  <p className="text-xs text-on-surface-variant">
                    {t('accounts.editDialog.hasTermsHint')}
                  </p>
                </div>
                <Switch
                  id="edit-account-terms"
                  checked={form.hasTerms}
                  onCheckedChange={(hasTerms) => update({ hasTerms })}
                />
              </div>
              {form.hasTerms ? (
                <CreditTermsFields
                  value={form}
                  onChange={update}
                  errors={{
                    statementDay: errorText(errors.statementDay),
                    paymentDueDay: errorText(errors.paymentDueDay),
                    interestRate: errorText(errors.interestRate),
                  }}
                />
              ) : null}
            </section>
          ) : null}

          {submitError ? (
            <p role="alert" className="text-[13px] text-expense">
              {submitError}
            </p>
          ) : null}

          <DialogFooter className="sm:justify-between">
            {initial.defaultCash ? (
              <p className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                {t('accounts.editDialog.defaultCashNote')}
              </p>
            ) : (
              <ArchiveAccountButton
                accountId={account.id}
                label={account.label}
                archived={account.archived}
                disabled={saving}
                onDone={(archived) => exit.after(onSaved)({ archived })}
                onError={setSubmitError}
              />
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={saving}>
                  {t('common.cancel')}
                </Button>
              </DialogClose>
              <Button type="submit" variant="secondary" disabled={saving}>
                {saving
                  ? t('accounts.editDialog.saving')
                  : t('accounts.editDialog.save')}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
