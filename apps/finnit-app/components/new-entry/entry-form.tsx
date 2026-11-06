import * as React from 'react';
import { useTranslations } from 'use-intl';
import { Sparkles } from 'lucide-react-native';

import { todayKey } from '@finnit/core/finance/dates';
import { applySuggestedCategory, currencyOf, merchantQuery, type EntryDraft, type EntryErrors } from '@finnit/core/new-entry/form';
import { SUGGEST_CATEGORY_QUERY, type EntryAccount, type EntryCategory } from '@finnit/core/new-entry/graphql';
import { accountOptions, categoryOptions } from '@finnit/core/new-entry/options';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { DatePicker } from '@finnit/ui-native/components/ui/date-picker';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Input } from '@finnit/ui-native/components/ui/input';
import { Select } from '@finnit/ui-native/components/ui/select';
import { Text } from '@finnit/ui-native/components/ui/text';

import { useGql } from '@/lib/graphql/runner';
import { useLocale } from '@/lib/i18n/i18n-provider';
import { AmountField } from './amount-field';

/** The category the merchant's history suggests, once the merchant settles (500 ms). */
function useCategorySuggestion(merchant: string): string | null {
  const gql = useGql();
  const [debounced, setDebounced] = React.useState(merchant);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(merchant), 500);
    return () => clearTimeout(timer);
  }, [merchant]);
  const query = merchantQuery(debounced);
  const [result, setResult] = React.useState<{ query: string; categoryId: string | null } | null>(null);
  React.useEffect(() => {
    if (!query) return;
    let cancelled = false;
    gql<{ suggestCategoryForMerchant: { id: string } | null }>(SUGGEST_CATEGORY_QUERY, { input: { merchantName: query } })
      .then((data) => !cancelled && setResult({ query, categoryId: data.suggestCategoryForMerchant?.id ?? null }))
      .catch(() => !cancelled && setResult({ query, categoryId: null }));
    return () => {
      cancelled = true;
    };
  }, [query, gql]);
  return query && result?.query === query ? result.categoryId : null;
}

/** Gasto or ingreso: amount, account, date, merchant, category and a note. */
export function EntryForm({
  draft,
  onChange,
  accounts,
  categories,
  errors,
  busy,
  busyLabel,
  submitError,
  onSubmit,
}: {
  draft: EntryDraft;
  onChange: (draft: EntryDraft) => void;
  accounts: EntryAccount[];
  categories: EntryCategory[];
  errors: EntryErrors;
  busy: boolean;
  busyLabel: string;
  submitError: string | null;
  onSubmit: () => void;
}) {
  const t = useTranslations('newEntry');
  const tc = useTranslations('common');
  const { locale } = useLocale();
  const today = todayKey();
  const accountItems = React.useMemo(() => accountOptions(accounts).map(({ value, label }) => ({ value, label })), [accounts]);
  const categoryItems = React.useMemo(
    () =>
      categoryOptions(categories, draft.type, locale).map((o) => ({
        value: o.value,
        label: o.label,
        hint: o.group && o.group !== o.label ? o.group : undefined,
      })),
    [categories, draft.type, locale],
  );
  const suggestedId = useCategorySuggestion(draft.merchant);
  React.useEffect(() => {
    const next = applySuggestedCategory(draft, suggestedId);
    if (next !== draft) onChange(next);
  }, [draft, suggestedId, onChange]);
  const showSuggested = !draft.categoryPicked && suggestedId !== null && draft.categoryId === suggestedId;
  const set = (patch: Partial<EntryDraft>) => onChange({ ...draft, ...patch });
  const isExpense = draft.type === 'expense';

  return (
    <TwView className="gap-4">
      <AmountField
        value={draft.amount}
        onChange={(amount) => set({ amount })}
        currency={currencyOf(accounts, draft.accountId)}
        error={errors.amount && t(`validation.${errors.amount}`)}
        autoFocus
      />
      <Select
        label={t('fields.account')}
        options={accountItems}
        value={draft.accountId ?? null}
        onValueChange={(accountId) => set({ accountId })}
        placeholder={t('fields.accountPlaceholder')}
        searchable={accountItems.length > 6}
        searchPlaceholder={t('fields.accountSearch')}
        emptyLabel={t('fields.accountEmpty')}
        error={errors.accountId && t(`validation.${errors.accountId}`)}
        closeLabel={tc('close')}
      />
      <DatePicker
        label={t('fields.date')}
        locale={locale}
        value={draft.date}
        onChange={(date) => set({ date })}
        max={today}
        placeholder={t('fields.datePlaceholder')}
        error={errors.date && t(`validation.${errors.date}`)}
        closeLabel={tc('close')}
      />
      <Input
        label={isExpense ? t('fields.merchantExpense') : t('fields.merchantIncome')}
        placeholder={isExpense ? t('fields.merchantExpensePlaceholder') : t('fields.merchantIncomePlaceholder')}
        value={draft.merchant}
        onChangeText={(merchant) => set({ merchant })}
        maxLength={120}
        autoCorrect={false}
      />
      <TwView className="gap-1">
        <Select
          label={t('fields.category')}
          options={categoryItems}
          value={draft.categoryId ?? null}
          onValueChange={(categoryId) => set({ categoryId, categoryPicked: true })}
          placeholder={t('fields.categoryPlaceholder')}
          searchable
          searchPlaceholder={t('fields.categorySearch')}
          emptyLabel={t('fields.categoryEmpty')}
          closeLabel={tc('close')}
        />
        {showSuggested ? (
          <TwView className="flex-row items-center gap-1 px-1">
            <Icon icon={Sparkles} size={14} color="--violet-ink" />
            <Text className="text-xs text-on-surface-variant">{t('fields.categorySuggested')}</Text>
          </TwView>
        ) : null}
      </TwView>
      <Input
        label={t('fields.note')}
        placeholder={t('fields.notePlaceholder')}
        value={draft.note}
        onChangeText={(note) => set({ note })}
        multiline
        maxLength={255}
        className="min-h-20 items-start"
        textAlignVertical="top"
      />
      {submitError ? (
        <Text accessibilityRole="alert" className="text-sm text-expense">
          {submitError}
        </Text>
      ) : null}
      <Button label={busy ? busyLabel : t(`submit.${draft.type}`)} disabled={busy} onPress={onSubmit} className="w-full" />
    </TwView>
  );
}
