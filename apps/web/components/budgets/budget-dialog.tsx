'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';

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
import { Input } from '@finnit/ui/components/ui/input';

import {
  budgetErrorMessage,
  saveBudget,
  type BudgetTarget,
} from '@/lib/budgets/api';
import {
  capsSum,
  hasBudgetErrors,
  totalBelowCaps,
  validateBudgetForm,
  type BudgetForm,
  type BudgetFormErrors,
  type CapRow,
} from '@/lib/budgets/form';
import { budgetCategoryOptions } from '@/lib/budgets/options';
import type { BudgetCategory } from '@/lib/budgets/types';
import { formatMoney } from '@/lib/finance/money';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import { CapField } from './cap-field';

/**
 * Create or edit a month's budget: an optional overall limit and caps per
 * category (top-level categories or subcategories). Mounted while open.
 */
export function BudgetDialog({
  target,
  initial,
  monthLabel,
  currency,
  categories,
  onClose,
  onSaved,
}: {
  target: BudgetTarget;
  initial: BudgetForm;
  monthLabel: string;
  currency: string;
  categories: BudgetCategory[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useLocalizer();
  const tf = useTranslations('budgets.form');
  const locale = useLocale();
  const [form, setForm] = React.useState(initial);
  const [errors, setErrors] = React.useState<BudgetFormErrors>({});
  const [saving, setSaving] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const nextKey = React.useRef(0);

  const allOptions = React.useMemo(
    () => budgetCategoryOptions(categories, locale),
    [categories, locale],
  );
  const nameOf = (categoryId: string) =>
    categories.find((c) => c.id === categoryId)?.name ?? tf('newCap');

  function update(patch: Partial<BudgetForm>) {
    setForm((current) => ({ ...current, ...patch }));
    setErrors({});
  }

  function updateRow(key: string, patch: Partial<CapRow>) {
    update({
      caps: form.caps.map((row) =>
        row.key === key ? { ...row, ...patch } : row,
      ),
    });
  }

  function addRow() {
    nextKey.current += 1;
    update({
      caps: [
        ...form.caps,
        { key: `new-${nextKey.current}`, categoryId: '', amount: '' },
      ],
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const found = validateBudgetForm(form);
    setErrors(found);
    if (hasBudgetErrors(found)) return;
    setSaving(true);
    setSubmitError(null);
    try {
      await saveBudget(form, target, gql);
      onSaved();
    } catch (error) {
      setSubmitError(budgetErrorMessage(error, t));
      setSaving(false);
    }
  }

  const sum = formatMoney(capsSum(form), currency, locale);
  const isEdit = target.mode === 'edit';

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent
        closeLabel={t('common.close')}
        className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl"
      >
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>
              {isEdit
                ? tf('editTitle', { month: monthLabel })
                : tf('createTitle', { month: monthLabel })}
            </DialogTitle>
            <DialogDescription>{tf('description')}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1">
            <Input
              label={tf('total')}
              inputMode="decimal"
              autoComplete="off"
              placeholder={tf('totalPlaceholder')}
              value={form.total}
              onChange={(e) => update({ total: e.target.value })}
              error={
                errors.total
                  ? t(`budgets.validation.${errors.total}`)
                  : undefined
              }
            />
            <p className="px-1 text-xs text-on-surface-variant">
              {tf('totalHint')}
            </p>
          </div>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 px-1 text-sm font-bold text-on-background">
              {tf('caps')}
            </legend>
            {form.caps.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {form.caps.map((row) => {
                  const usedElsewhere = new Set(
                    form.caps
                      .filter((other) => other.key !== row.key)
                      .map((other) => other.categoryId),
                  );
                  return (
                    <CapField
                      key={row.key}
                      row={row}
                      options={allOptions.map((option) => ({
                        ...option,
                        disabled: usedElsewhere.has(option.value),
                      }))}
                      categoryLabel={nameOf(row.categoryId)}
                      errors={errors.caps?.[row.key]}
                      onChange={(patch) => updateRow(row.key, patch)}
                      onRemove={() =>
                        update({
                          caps: form.caps.filter(
                            (other) => other.key !== row.key,
                          ),
                        })
                      }
                    />
                  );
                })}
              </ul>
            ) : (
              <p className="px-1 text-sm text-on-surface-variant">
                {tf('noCaps')}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addRow}
              >
                <Plus aria-hidden /> {tf('addCap')}
              </Button>
              {form.caps.length > 0 ? (
                <span className="text-xs text-on-surface-variant tabular-nums">
                  {tf('capsSum', { amount: sum })}
                </span>
              ) : null}
            </div>
            <p className="px-1 text-xs text-on-surface-variant">
              {tf('capsHint')}
            </p>
          </fieldset>

          {totalBelowCaps(form) ? (
            <p className="rounded-input bg-amber-500/10 p-3 text-xs text-on-background">
              {tf('totalBelowCaps', { amount: sum })}
            </p>
          ) : null}
          {errors.form ? (
            <p role="alert" className="text-[13px] text-expense">
              {t('budgets.validation.empty')}
            </p>
          ) : hasBudgetErrors(errors) ? (
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
              {saving ? tf('saving') : isEdit ? tf('save') : tf('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
