'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';

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
import { Textarea } from '@finnit/ui/components/ui/textarea';

import { AmountField } from '@/components/new-entry/amount-field';
import { todayKey } from '@/lib/finance/dates';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import { categoryOptions } from '@/lib/new-entry/options';
import {
  transactionErrorMessage,
  updateTransaction,
} from '@/lib/transaction-detail/api';
import {
  DESCRIPTION_MAX,
  MERCHANT_MAX,
  buildUpdateInput,
  validateDetailForm,
  type DetailForm,
  type DetailFormErrors,
} from '@/lib/transaction-detail/form';
import type { DetailCategory } from '@/lib/transaction-detail/types';
import type { EditRules } from '@/lib/transaction-detail/view';

/**
 * "Editar": only the fields the API lets this movement change (see
 * editRules). Mounted while open, so it starts from the saved values.
 */
export function EditTransactionDialog({
  transactionId,
  initial,
  rules,
  currency,
  categories,
  categoryKind,
  isTransfer,
  onClose,
  onSaved,
}: {
  transactionId: string;
  initial: DetailForm;
  rules: EditRules;
  currency: string;
  categories: DetailCategory[];
  categoryKind: 'expense' | 'income';
  isTransfer: boolean;
  onClose: () => void;
  /** `changed` is false when nothing was different. */
  onSaved: (changed: boolean) => void;
}) {
  const { t } = useLocalizer();
  const tf = useTranslations('transaction.form');
  const locale = useLocale();
  const [form, setForm] = React.useState(initial);
  const [errors, setErrors] = React.useState<DetailFormErrors>({});
  const [saving, setSaving] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const options = React.useMemo(
    () => categoryOptions(categories, categoryKind, locale),
    [categories, categoryKind, locale],
  );
  const today = todayKey();
  const onlyCategory =
    rules.category && !rules.amount && !rules.merchant && !rules.description;

  const update = (patch: Partial<DetailForm>) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      if ('amount' in patch) delete next.amount;
      if ('date' in patch) delete next.date;
      return next;
    });
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const found = validateDetailForm(form, rules, today);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const input = buildUpdateInput(form, initial, rules);
    if (!input) {
      onSaved(false);
      return;
    }
    setSaving(true);
    setSubmitError(null);
    try {
      await updateTransaction(transactionId, input, gql);
      onSaved(true);
    } catch (error) {
      setSubmitError(transactionErrorMessage(error, t));
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent
        closeLabel={t('common.close')}
        className="max-h-[92dvh] overflow-y-auto sm:max-w-lg"
      >
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{t('transaction.editTitle')}</DialogTitle>
            <DialogDescription>
              {onlyCategory
                ? t('transaction.editImported')
                : isTransfer
                  ? t('transaction.editTransfer')
                  : t('transaction.editDescription')}
            </DialogDescription>
          </DialogHeader>

          {rules.amount ? (
            <AmountField
              value={form.amount}
              onChange={(amount) => update({ amount })}
              currency={currency}
              error={
                errors.amount
                  ? t(`transaction.validation.${errors.amount}`)
                  : undefined
              }
            />
          ) : null}
          {rules.date ? (
            <DatePicker
              label={tf('date')}
              value={form.date || undefined}
              onChange={(date) => update({ date: date ?? '' })}
              max={today}
              locale={locale}
              placeholder={tf('datePlaceholder')}
              required
              error={
                errors.date
                  ? t(`transaction.validation.${errors.date}`)
                  : undefined
              }
            />
          ) : null}
          {rules.category ? (
            <Combobox
              label={tf('category')}
              options={options}
              value={form.categoryId || undefined}
              onChange={(categoryId) =>
                update({ categoryId: categoryId ?? '' })
              }
              placeholder={tf('categoryPlaceholder')}
              searchPlaceholder={tf('categorySearch')}
              emptyText={tf('noResults')}
            />
          ) : null}
          {rules.merchant ? (
            <Input
              label={tf('merchant')}
              value={form.merchantName}
              maxLength={MERCHANT_MAX}
              autoComplete="off"
              placeholder={tf('merchantPlaceholder')}
              onChange={(e) => update({ merchantName: e.target.value })}
            />
          ) : null}
          {rules.description ? (
            <Textarea
              label={tf('description')}
              value={form.description}
              maxLength={DESCRIPTION_MAX}
              rows={3}
              placeholder={tf('descriptionPlaceholder')}
              onChange={(e) => update({ description: e.target.value })}
            />
          ) : null}

          {submitError ? (
            <p role="alert" className="text-sm text-expense">
              {submitError}
            </p>
          ) : null}

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={saving}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? tf('saving') : tf('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
