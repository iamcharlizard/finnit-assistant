'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2, Plus, Sparkles, Trash2 } from 'lucide-react';

import { Badge } from '@finnit/ui/components/ui/badge';
import { Button } from '@finnit/ui/components/ui/button';
import { Checkbox } from '@finnit/ui/components/ui/checkbox';
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
import { ContactCombobox } from '@/components/contacts/contact-combobox';
import { LendingMethodField } from './lending-method-field';
import { useDialogExit } from '@finnit/ui/lib/use-dialog-exit';
import { Input } from '@finnit/ui/components/ui/input';
import { NumberInput } from '@finnit/ui/components/ui/number-input';
import { MoneyInput } from '@finnit/ui/components/ui/money-input';
import { Label } from '@finnit/ui/components/ui/label';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@finnit/ui/components/ui/toggle-group';

import { SwitchField } from '@/components/finance/switch-field';
import { SelectField } from '@/components/recurring/select-field';
import { budgetCategoryOptions } from '@/lib/budgets/options';
import type { BudgetCategory } from '@/lib/budgets/types';
import { debtErrorMessage, loadLoanDraft, saveLoan } from '@/lib/debts/api';
import { hasErrors, NAME_MAX } from '@/lib/debts/form';
import {
  depositMismatch,
  expectedDeposit,
  formOfDraft,
  isFixedTerm,
  loanPreview,
  newHistoricalRow,
  newLoanForm,
  validateLoanForm,
  startsEmpty,
  withLoanType,
  withDefaultPaymentCategory,
  defaultPaymentCategoryId,
  type HistoricalRow,
  type LoanErrorCode,
  type LoanForm,
  type LoanFormErrors,
} from '@/lib/debts/loan-form';
import { loanAccounts } from '@/lib/debts/detail-view';
import {
  LOAN_FREQUENCIES,
  LOAN_INTEREST_MODES,
  LOAN_TYPES,
  destinationOfMethod,
  type ApiLoanDraft,
  type LoanType,
} from '@/lib/debts/types';
import type { DayKey } from '@/lib/finance/dates';
import { formatMoney, DEFAULT_CURRENCY } from '@/lib/finance/money';
import type { ApiAccount } from '@/lib/finance/types';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import { accountOptions } from '@/lib/new-entry/options';

/**
 * A new loan, by type: institutional (fixed payments), personal (flexible,
 * may grow) or purchase financing (Kueski, Didi). With `fingerprint` it
 * turns a recurring suggestion into the loan: the AI's draft fills the
 * form and the detected charges become paid installments. Mounted while
 * open.
 */
export function LoanDialog({
  fingerprint = null,
  accounts,
  categories,
  today,
  onClose,
  onSaved,
}: {
  fingerprint?: string | null;
  accounts: ApiAccount[];
  categories: BudgetCategory[];
  today: DayKey;
  onClose: () => void;
  onSaved: (id: string, name: string) => void;
}) {
  // Closes with the exit animation before telling the parent.
  const exit = useDialogExit();
  const { t } = useLocalizer();
  const tf = useTranslations('debts.loan');
  const locale = useLocale();
  const [form, setForm] = React.useState<LoanForm>(() =>
    withDefaultPaymentCategory(newLoanForm(), categories),
  );
  const [draft, setDraft] = React.useState<ApiLoanDraft | null>(null);
  const [loading, setLoading] = React.useState(Boolean(fingerprint));
  const [errors, setErrors] = React.useState<LoanFormErrors>({});
  const [saving, setSaving] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!fingerprint) return;
    let active = true;
    loadLoanDraft(fingerprint, gql)
      .then((loaded) => {
        if (!active) return;
        setDraft(loaded);
        // Loans & Debts over the category the charges were guessed under.
        const prefilled = formOfDraft(loaded);
        const fallback = defaultPaymentCategoryId(
          categories,
          prefilled.loanType,
        );
        setForm(fallback ? { ...prefilled, categoryId: fallback } : prefilled);
      })
      .catch((error: unknown) => {
        if (active) setSubmitError(debtErrorMessage(error, t));
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [fingerprint, t, categories]);

  const usable = React.useMemo(() => loanAccounts(accounts), [accounts]);
  const accountItems = React.useMemo(() => accountOptions(usable), [usable]);
  const categoryItems = React.useMemo(
    () => budgetCategoryOptions(categories, locale),
    [categories, locale],
  );
  const preview = loanPreview(form);
  const money = (n: number) => formatMoney(n, DEFAULT_CURRENCY, locale);
  const fixed = isFixedTerm(form.loanType);
  const scheduled = fixed || form.hasSchedule;
  const detected = draft?.paymentsDetected ?? 0;
  // Live: the save button stays off while the deposit doesn't add up.
  const mismatch = depositMismatch(form);
  const deposit = expectedDeposit(form);
  const feeError = mismatch
    ? t('debts.loanValidation.depositMismatch', {
        expected: money(mismatch.expected),
        typed: money(mismatch.typed),
      })
    : errors.openingFee === 'openingFeeInvalid'
      ? t('debts.loanValidation.openingFeeInvalid')
      : undefined;
  const errorText = (code: LoanErrorCode | undefined) =>
    code ? t(`debts.loanValidation.${code}`) : undefined;

  function update(patch: Partial<LoanForm>) {
    setForm((current) => ({ ...current, ...patch }));
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch)) delete next[key as keyof LoanForm];
      return next;
    });
  }

  function updateRow(key: string, patch: Partial<HistoricalRow>) {
    update({
      historical: form.historical.map((row) =>
        row.key === key ? { ...row, ...patch } : row,
      ),
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const found = validateLoanForm(form, { today, detectedPayments: detected });
    setErrors(found);
    if (hasErrors(found)) return;
    setSaving(true);
    setSubmitError(null);
    try {
      const id = await saveLoan(form, fingerprint, gql);
      exit.after(onSaved)(id, form.name.trim());
    } catch (error) {
      setSubmitError(debtErrorMessage(error, t));
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
        className="sm:max-w-2xl"
      >
        <form onSubmit={submit} noValidate className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>
              {fingerprint ? tf('fromSuggestionTitle') : tf('createTitle')}
            </DialogTitle>
            <DialogDescription>
              {fingerprint
                ? tf('fromSuggestionDescription')
                : tf('createDescription')}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="gap-6">
            {loading ? (
              <p className="flex items-center gap-2 text-sm text-on-surface-variant">
                <Loader2 aria-hidden className="size-4 animate-spin" />
                {tf('draftLoading')}
              </p>
            ) : null}

            {draft ? (
              <p className="flex flex-wrap items-center gap-2 rounded-input bg-track/60 p-3 text-xs text-on-background">
                {draft.classifiedBy === 'ai' ? (
                  <Badge variant="brand">
                    <Sparkles aria-hidden /> {t('recurring.suggestions.ai')}
                  </Badge>
                ) : null}
                {tf('draftDetected', {
                  count: draft.paymentsDetected,
                  amount: money(draft.installmentAmount),
                })}
              </p>
            ) : null}

            <fieldset className="flex flex-col gap-2" disabled={loading}>
              <Label className="px-1">{tf('type')}</Label>
              <ToggleGroup
                type="single"
                value={form.loanType}
                onValueChange={(value) =>
                  value &&
                  setForm(
                    withDefaultPaymentCategory(
                      withLoanType(form, value as LoanType),
                      categories,
                      form.loanType,
                    ),
                  )
                }
                className="flex-wrap"
              >
                {LOAN_TYPES.map((type) => (
                  <ToggleGroupItem key={type} value={type}>
                    {t(`debts.loanTypes.${type}`)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <p className="px-1 text-xs text-on-surface-variant">
                {t(`debts.loanTypeHints.${form.loanType}`)}
              </p>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label={tf('name')}
                value={form.name}
                maxLength={NAME_MAX}
                autoComplete="off"
                placeholder={tf(`namePlaceholder.${form.loanType}`)}
                onChange={(e) => update({ name: e.target.value })}
                error={errorText(errors.name)}
              />
              {form.loanType === 'personal' ? (
                <ContactCombobox
                  label={tf('lender.personal')}
                  value={form.lenderContactId}
                  name={form.lenderName}
                  placeholder={form.lenderName || undefined}
                  onChange={(contact) =>
                    update({
                      lenderContactId: contact?.id ?? '',
                      lenderName: contact?.name ?? '',
                    })
                  }
                />
              ) : (
                <Input
                  label={tf(`lender.${form.loanType}`)}
                  value={form.lenderName}
                  maxLength={NAME_MAX}
                  autoComplete="off"
                  onChange={(e) => update({ lenderName: e.target.value })}
                />
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <MoneyInput
                  label={tf(`principal.${form.loanType}`)}
                  value={form.principal}
                  onValueChange={(value) => update({ principal: value })}
                  error={errorText(errors.principal)}
                />
                {form.loanType === 'personal' ? (
                  <p className="px-1 text-xs text-on-surface-variant">
                    {tf('principalPersonalHint')}
                  </p>
                ) : null}
              </div>
              <DatePicker
                label={tf(`startDate.${form.loanType}`)}
                value={form.startDate || undefined}
                onChange={(day) => update({ startDate: day ?? '' })}
                max={today}
                locale={locale}
                placeholder={tf('datePlaceholder')}
                clearable
                clearLabel={tf('clearDate')}
                error={errorText(errors.startDate)}
              />
            </div>

            {form.loanType === 'institutional' ? (
              <div className="flex flex-col gap-1">
                <MoneyInput
                  label={tf('openingFee')}
                  value={form.openingFee}
                  onValueChange={(value) => update({ openingFee: value })}
                  error={feeError}
                />
                <p className="px-1 text-xs text-on-surface-variant">
                  {tf('openingFeeHint')}
                </p>
              </div>
            ) : null}

            <section className="flex flex-col gap-4 rounded-card border border-outline p-4">
              <h3 className="text-sm font-bold text-on-background">
                {tf('termsTitle')}
              </h3>

              {fixed ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <NumberInput
                      maxDigits={4}
                      label={tf('installments')}
                      placeholder={tf('installmentsPlaceholder')}
                      value={form.installments}
                      onValueChange={(value) => update({ installments: value })}
                      error={errorText(errors.installments)}
                    />
                    <SelectField
                      label={tf('frequency')}
                      value={form.frequency}
                      options={LOAN_FREQUENCIES.map((f) => ({
                        value: f,
                        label: t(`debts.loanFrequencies.${f}`),
                      }))}
                      onChange={(frequency) => update({ frequency })}
                    />
                  </div>
                  <SelectField
                    label={tf('interestMode')}
                    value={form.interestMode}
                    options={LOAN_INTEREST_MODES.map((mode) => ({
                      value: mode,
                      label: t(`debts.interestModes.${mode}`),
                    }))}
                    onChange={(interestMode) => update({ interestMode })}
                    hint={t(`debts.interestModeHints.${form.interestMode}`)}
                  />
                  {form.interestMode === 'rate' ? (
                    <div className="flex flex-col gap-3">
                      <NumberInput
                        decimals={4}
                        suffix="%"
                        label={tf('rate')}
                        placeholder={tf('ratePlaceholder')}
                        value={form.rate}
                        onValueChange={(value) => update({ rate: value })}
                        error={errorText(errors.rate)}
                      />
                      <p className="-mt-2 px-1 text-xs text-on-surface-variant">
                        {tf('rateHint')}
                      </p>
                      <SwitchField
                        label={tf('vat')}
                        hint={tf('vatHint')}
                        checked={form.includesVat}
                        onCheckedChange={(includesVat) =>
                          update({ includesVat })
                        }
                      />
                      {form.loanType === 'institutional' ? (
                        <>
                          <div className="flex flex-col gap-1">
                            <MoneyInput
                              label={tf('periodicFee')}
                              value={form.periodicFee}
                              onValueChange={(value) =>
                                update({ periodicFee: value })
                              }
                              error={errorText(errors.periodicFee)}
                            />
                            <p className="px-1 text-xs text-on-surface-variant">
                              {tf('periodicFeeHint')}
                            </p>
                          </div>
                          {form.periodicFee.trim() ? (
                            <SwitchField
                              label={tf('periodicFeeAddVat')}
                              checked={form.periodicFeeAddVat}
                              onCheckedChange={(periodicFeeAddVat) =>
                                update({ periodicFeeAddVat })
                              }
                            />
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  ) : null}
                  {form.interestMode === 'total_amount' ? (
                    <MoneyInput
                      label={tf('totalToRepay')}
                      value={form.totalToRepay}
                      onValueChange={(value) => update({ totalToRepay: value })}
                      error={errorText(errors.totalToRepay)}
                    />
                  ) : null}
                  {form.interestMode === 'installment_amount' ? (
                    <MoneyInput
                      label={tf('installmentAmount')}
                      value={form.installmentAmount}
                      onValueChange={(value) =>
                        update({ installmentAmount: value })
                      }
                      error={errorText(errors.installmentAmount)}
                    />
                  ) : null}
                </>
              ) : (
                <>
                  <div className="flex flex-col gap-1">
                    <MoneyInput
                      label={tf('personalTotal')}
                      placeholder={tf('personalTotalPlaceholder')}
                      value={form.totalToRepay}
                      onValueChange={(value) => update({ totalToRepay: value })}
                      error={errorText(errors.totalToRepay)}
                    />
                    <p className="px-1 text-xs text-on-surface-variant">
                      {tf('personalTotalHint')}
                    </p>
                  </div>
                  <SwitchField
                    label={tf('hasSchedule')}
                    hint={tf('hasScheduleHint')}
                    checked={form.hasSchedule}
                    onCheckedChange={(hasSchedule) => update({ hasSchedule })}
                  />
                  {form.hasSchedule ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <MoneyInput
                        label={tf('agreedPayment')}
                        value={form.installmentAmount}
                        onValueChange={(value) =>
                          update({ installmentAmount: value })
                        }
                        error={errorText(errors.installmentAmount)}
                      />
                      <SelectField
                        label={tf('frequency')}
                        value={form.frequency}
                        options={LOAN_FREQUENCIES.map((f) => ({
                          value: f,
                          label: t(`debts.loanFrequencies.${f}`),
                        }))}
                        onChange={(frequency) => update({ frequency })}
                      />
                    </div>
                  ) : null}
                </>
              )}

              {scheduled ? (
                <DatePicker
                  label={tf('firstPaymentDate')}
                  value={form.firstPaymentDate || undefined}
                  onChange={(day) => update({ firstPaymentDate: day ?? '' })}
                  locale={locale}
                  placeholder={tf('datePlaceholder')}
                  required
                  error={errorText(errors.firstPaymentDate)}
                />
              ) : null}

              {preview && fixed ? (
                <p
                  aria-live="polite"
                  className="rounded-input bg-income/10 p-3 text-sm text-on-background"
                >
                  {tf('preview', {
                    count: Number(form.installments),
                    amount: money(preview.installmentAmount),
                    total: money(preview.totalToRepay),
                    interest: money(Math.max(0, preview.interest)),
                  })}
                  {preview.fees
                    ? ` · ${tf('previewFees', { fees: money(preview.fees) })}`
                    : null}
                </p>
              ) : null}
            </section>

            <section className="flex flex-col gap-3 rounded-card border border-outline p-4">
              <h3 className="text-sm font-bold text-on-background">
                {tf('paidTitle')}
              </h3>
              <p className="text-xs text-on-surface-variant">
                {tf('paidHint')}
              </p>
              {fixed ? (
                <NumberInput
                  maxDigits={4}
                  label={tf('installmentsPaid')}
                  placeholder="0"
                  value={form.installmentsPaid}
                  onValueChange={(value) => update({ installmentsPaid: value })}
                  error={errorText(errors.installmentsPaid)}
                />
              ) : (
                <>
                  {form.historical.length > 0 ? (
                    <ul className="flex flex-col gap-3">
                      {form.historical.map((row, index) => (
                        <li
                          key={row.key}
                          className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_1.4fr_auto]"
                        >
                          <MoneyInput
                            label={tf('historicalAmount')}
                            value={row.amount}
                            onValueChange={(value) =>
                              updateRow(row.key, { amount: value })
                            }
                          />
                          <DatePicker
                            label={tf('historicalDate')}
                            value={row.date || undefined}
                            onChange={(day) =>
                              updateRow(row.key, { date: day ?? '' })
                            }
                            max={today}
                            locale={locale}
                            placeholder={tf('datePlaceholder')}
                          />
                          <Combobox
                            label={tf('historicalAccount')}
                            options={accountItems}
                            value={row.accountId || undefined}
                            onChange={(accountId) =>
                              updateRow(row.key, { accountId: accountId ?? '' })
                            }
                            placeholder={tf('historicalAccountPlaceholder')}
                            searchPlaceholder={tf('accountSearch')}
                            emptyText={tf('noResults')}
                            clearable
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={tf('removeHistorical', {
                              number: index + 1,
                            })}
                            onClick={() =>
                              update({
                                historical: form.historical.filter(
                                  (r) => r.key !== row.key,
                                ),
                              })
                            }
                          >
                            <Trash2 aria-hidden />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {errors.historical ? (
                    <p role="alert" className="text-[13px] text-expense">
                      {errorText(errors.historical)}
                    </p>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="self-start"
                    onClick={() =>
                      update({
                        historical: [
                          ...form.historical,
                          newHistoricalRow(today),
                        ],
                      })
                    }
                  >
                    <Plus aria-hidden /> {tf('addHistorical')}
                  </Button>
                </>
              )}
            </section>

            {startsEmpty(form) ? null : (
              <section className="flex flex-col gap-3 rounded-card border border-outline p-4">
                <h3 className="text-sm font-bold text-on-background">
                  {tf('destinationTitle')}
                </h3>
                {form.loanType === 'personal' ? (
                  <LendingMethodField
                    value={form.lendingMethod}
                    onChange={(lendingMethod) =>
                      update({
                        lendingMethod,
                        ...(lendingMethod && {
                          destination: destinationOfMethod(lendingMethod),
                        }),
                      })
                    }
                  />
                ) : null}
                <ToggleGroup
                  type="single"
                  value={form.destination}
                  onValueChange={(value) =>
                    value &&
                    update({ destination: value as LoanForm['destination'] })
                  }
                  className="flex-wrap"
                >
                  <ToggleGroupItem value="deposit">
                    {t('debts.destinations.deposit')}
                  </ToggleGroupItem>
                  <ToggleGroupItem value="purchase">
                    {t('debts.destinations.purchase')}
                  </ToggleGroupItem>
                </ToggleGroup>
                <p className="px-1 text-xs text-on-surface-variant">
                  {t(`debts.destinationHints.${form.destination}`)}
                </p>
                {form.destination === 'deposit' ? (
                  <>
                    <Combobox
                      label={tf('depositAccount')}
                      options={accountItems}
                      value={form.depositAccountId || undefined}
                      onChange={(depositAccountId) =>
                        update({ depositAccountId: depositAccountId ?? '' })
                      }
                      placeholder={tf('accountPlaceholder')}
                      searchPlaceholder={tf('accountSearch')}
                      emptyText={tf('noResults')}
                      error={errorText(errors.depositAccountId)}
                    />
                    {form.loanType === 'institutional' ? (
                      <div className="flex flex-col gap-2">
                        <MoneyInput
                          label={tf('depositAmount')}
                          disabled={!form.editDeposit}
                          value={
                            form.editDeposit
                              ? form.depositAmount
                              : deposit !== null
                                ? deposit.toFixed(2)
                                : ''
                          }
                          onValueChange={(value) =>
                            update({ depositAmount: value })
                          }
                        />
                        <div className="flex items-center gap-3 px-1">
                          <Checkbox
                            id="loan-edit-deposit"
                            checked={form.editDeposit}
                            onCheckedChange={(checked) =>
                              update({
                                editDeposit: checked === true,
                                // Start from the computed amount.
                                depositAmount:
                                  checked === true && deposit !== null
                                    ? deposit.toFixed(2)
                                    : form.depositAmount,
                              })
                            }
                          />
                          <label
                            htmlFor="loan-edit-deposit"
                            className="text-sm text-on-surface-variant"
                          >
                            {tf('editDeposit')}
                          </label>
                        </div>
                        <p className="px-1 text-xs text-on-surface-variant">
                          {tf('depositAmountHint')}
                        </p>
                      </div>
                    ) : null}
                    <SwitchField
                      label={tf('countsAsIncome')}
                      hint={tf('countsAsIncomeHint')}
                      checked={form.depositCountsAsIncome}
                      onCheckedChange={(depositCountsAsIncome) =>
                        update({ depositCountsAsIncome })
                      }
                    />
                  </>
                ) : null}
              </section>
            )}

            <div className="flex flex-col gap-1">
              <Combobox
                label={tf('purpose')}
                options={categoryItems}
                value={form.purposeCategoryId || undefined}
                onChange={(purposeCategoryId) =>
                  update({ purposeCategoryId: purposeCategoryId ?? '' })
                }
                placeholder={tf('purposePlaceholder')}
                searchPlaceholder={tf('categorySearch')}
                emptyText={tf('noResults')}
                clearable
              />
              <p className="px-1 text-xs text-on-surface-variant">
                {tf('purposeHint')}
              </p>
            </div>

            {scheduled ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <Combobox
                    label={tf('paymentAccount')}
                    options={accountItems}
                    value={form.paymentAccountId || undefined}
                    onChange={(paymentAccountId) =>
                      update({ paymentAccountId: paymentAccountId ?? '' })
                    }
                    placeholder={tf('accountPlaceholder')}
                    searchPlaceholder={tf('accountSearch')}
                    emptyText={tf('noResults')}
                    clearable
                  />
                  <p className="px-1 text-xs text-on-surface-variant">
                    {tf('paymentAccountHint')}
                  </p>
                </div>
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
            ) : null}

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
            <Button
              type="submit"
              variant="secondary"
              disabled={saving || loading || mismatch !== null}
            >
              {saving ? tf('saving') : tf('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
