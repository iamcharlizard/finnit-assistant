'use client';

import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import {
  Combobox,
  type ComboboxOption,
} from '@finnit/ui/components/ui/combobox';
import { Input } from '@finnit/ui/components/ui/input';

import type { BudgetErrorCode, CapRow } from '@/lib/budgets/form';

/** One cap in the budget dialog: category, amount and a remove button. */
export function CapField({
  row,
  options,
  categoryLabel,
  errors,
  onChange,
  onRemove,
}: {
  row: CapRow;
  /** Categories; the ones other rows use are disabled. */
  options: ComboboxOption[];
  /** The chosen category's name, for the remove button's label. */
  categoryLabel: string;
  errors?: { category?: BudgetErrorCode; amount?: BudgetErrorCode };
  onChange: (patch: Partial<CapRow>) => void;
  onRemove: () => void;
}) {
  const t = useTranslations('budgets');
  const errorText = (code?: BudgetErrorCode) =>
    code ? t(`validation.${code}`) : undefined;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)_auto]">
      <Combobox
        aria-label={t('form.category')}
        options={options}
        value={row.categoryId || undefined}
        onChange={(categoryId) => onChange({ categoryId: categoryId ?? '' })}
        placeholder={t('form.categoryPlaceholder')}
        searchPlaceholder={t('form.categorySearch')}
        emptyText={t('form.noResults')}
        error={errorText(errors?.category)}
        className="col-span-1"
      />
      <div className="order-3 col-span-1 sm:order-none">
        <Input
          aria-label={t('form.capAmount', { category: categoryLabel })}
          inputMode="decimal"
          autoComplete="off"
          placeholder={t('form.capPlaceholder')}
          value={row.amount}
          onChange={(e) => onChange({ amount: e.target.value })}
          error={errorText(errors?.amount)}
        />
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemove}
        aria-label={t('form.remove', { category: categoryLabel })}
      >
        <X aria-hidden />
      </Button>
    </li>
  );
}
