import * as React from 'react';
import { useTranslations } from 'use-intl';
import { Plus, X } from 'lucide-react-native';

import { budgetErrorMessage, saveBudget, type BudgetTarget } from '@finnit/core/budgets/api';
import { capsSum, hasBudgetErrors, totalBelowCaps, validateBudgetForm, type BudgetForm, type BudgetFormErrors, type CapRow } from '@finnit/core/budgets/form';
import { budgetCategoryOptions } from '@finnit/core/budgets/options';
import type { BudgetCategory } from '@finnit/core/budgets/types';
import { formatMoney } from '@finnit/core/finance/money';
import { TwScrollView, TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { MoneyInput } from '@finnit/ui-native/components/ui/money-input';
import { Select } from '@finnit/ui-native/components/ui/select';
import { Sheet } from '@finnit/ui-native/components/ui/sheet';
import { Text } from '@finnit/ui-native/components/ui/text';

import { useGql } from '@/lib/graphql/runner';
import { useLocalizer } from '@/lib/i18n/i18n-provider';

/** Creating or editing a month's budget: an optional total and caps by category. */
export function BudgetSheet({
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
  const l = useLocalizer();
  const t = useTranslations();
  const tf = useTranslations('budgets.form');
  const gql = useGql();
  const [form, setForm] = React.useState(initial);
  const [errors, setErrors] = React.useState<BudgetFormErrors>({});
  const [saving, setSaving] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const nextKey = React.useRef(0);
  const options = React.useMemo(
    () =>
      budgetCategoryOptions(categories, l.locale).map((o) => ({
        value: o.value,
        label: o.label,
        hint: o.group && o.group !== o.label ? o.group : undefined,
      })),
    [categories, l.locale],
  );
  const nameOf = (id: string) => categories.find((c) => c.id === id)?.name ?? tf('newCap');
  const update = (patch: Partial<BudgetForm>) => {
    setForm((current) => ({ ...current, ...patch }));
    setErrors({});
  };
  const updateRow = (key: string, patch: Partial<CapRow>) =>
    update({ caps: form.caps.map((row) => (row.key === key ? { ...row, ...patch } : row)) });

  async function submit() {
    const found = validateBudgetForm(form);
    setErrors(found);
    if (hasBudgetErrors(found)) return;
    setSaving(true);
    setSubmitError(null);
    try {
      await saveBudget(form, target, gql);
      onSaved();
    } catch (error) {
      setSubmitError(budgetErrorMessage(error, l.t));
      setSaving(false);
    }
  }

  const sum = formatMoney(capsSum(form), currency, l.locale);
  const isEdit = target.mode === 'edit';
  const code = (c?: string) => (c ? t(`budgets.validation.${c}` as 'budgets.validation.empty') : undefined);

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && !saving && onClose()}
      title={isEdit ? tf('editTitle', { month: monthLabel }) : tf('createTitle', { month: monthLabel })}
      description={tf('description')}
      closeLabel={t('common.close')}
    >
      <TwScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 560 }} contentContainerClassName="gap-4 pb-2">
        <TwView className="gap-1">
          <MoneyInput
            label={tf('total')}
            placeholder={tf('totalPlaceholder')}
            value={form.total}
            onValueChange={(total) => update({ total })}
            currency={currency}
            error={code(errors.total)}
          />
          <Text className="px-1 text-xs text-on-surface-variant">{tf('totalHint')}</Text>
        </TwView>
        <Text weight="bold" className="px-1 text-sm">
          {tf('caps')}
        </Text>
        {form.caps.length > 0 ? (
          form.caps.map((row) => {
            const used = new Set(form.caps.filter((o) => o.key !== row.key).map((o) => o.categoryId));
            const rowErrors = errors.caps?.[row.key];
            return (
              <TwView key={row.key} className="gap-2 rounded-xl border border-outline p-3">
                <TwView className="flex-row items-start gap-2">
                  <TwView className="flex-1">
                    <Select
                      value={row.categoryId || null}
                      options={options.filter((o) => !used.has(o.value))}
                      onValueChange={(categoryId) => updateRow(row.key, { categoryId })}
                      placeholder={tf('categoryPlaceholder')}
                      title={tf('category')}
                      searchable
                      searchPlaceholder={tf('categorySearch')}
                      emptyLabel={tf('noResults')}
                      error={code(rowErrors?.category)}
                      closeLabel={t('common.close')}
                    />
                  </TwView>
                  <Button
                    variant="ghost"
                    size="icon"
                    icon={X}
                    label={tf('remove', { category: nameOf(row.categoryId) })}
                    onPress={() => update({ caps: form.caps.filter((o) => o.key !== row.key) })}
                  />
                </TwView>
                <MoneyInput
                  placeholder={tf('capPlaceholder')}
                  value={row.amount}
                  onValueChange={(amount) => updateRow(row.key, { amount })}
                  currency={currency}
                  error={code(rowErrors?.amount)}
                />
              </TwView>
            );
          })
        ) : (
          <Text className="px-1 text-sm text-on-surface-variant">{tf('noCaps')}</Text>
        )}
        <TwView className="flex-row flex-wrap items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={Plus}
            label={tf('addCap')}
            onPress={() => {
              nextKey.current += 1;
              update({ caps: [...form.caps, { key: `new-${nextKey.current}`, categoryId: '', amount: '' }] });
            }}
          />
          {form.caps.length > 0 ? <Text className="text-xs text-on-surface-variant">{tf('capsSum', { amount: sum })}</Text> : null}
        </TwView>
        <Text className="px-1 text-xs text-on-surface-variant">{tf('capsHint')}</Text>
        {totalBelowCaps(form) ? (
          <Text className="rounded-input bg-[rgba(245,158,11,0.1)] p-3 text-xs">{tf('totalBelowCaps', { amount: sum })}</Text>
        ) : null}
        {errors.form ? (
          <Text accessibilityRole="alert" className="text-[13px] text-expense">
            {t('budgets.validation.empty')}
          </Text>
        ) : hasBudgetErrors(errors) ? (
          <Text accessibilityRole="alert" className="text-[13px] text-expense">
            {tf('fixErrors')}
          </Text>
        ) : null}
        {submitError ? (
          <Text accessibilityRole="alert" className="text-[13px] text-expense">
            {submitError}
          </Text>
        ) : null}
        <Button
          variant="secondary"
          label={saving ? tf('saving') : isEdit ? tf('save') : tf('create')}
          onPress={submit}
          disabled={saving}
          className="w-full"
        />
      </TwScrollView>
    </Sheet>
  );
}
