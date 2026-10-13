'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { Combobox } from '@finnit/ui/components/ui/combobox';
import { DatePicker } from '@finnit/ui/components/ui/date-picker';
import { FileDropzone } from '@finnit/ui/components/ui/file-dropzone';
import { Input } from '@finnit/ui/components/ui/input';
import { Label } from '@finnit/ui/components/ui/label';
import { Textarea } from '@finnit/ui/components/ui/textarea';

import { useCategorySuggestion } from '@/hooks/use-category-suggestion';
import { MAX_UPLOAD_BYTES } from '@/lib/files/routes';
import { todayKey } from '@/lib/finance/dates';
import { ATTACHMENT_ACCEPT } from '@/lib/new-entry/errors';
import {
  applySuggestedCategory,
  currencyOf,
  type EntryDraft,
  type EntryErrors,
} from '@/lib/new-entry/form';
import type { EntryAccount, EntryCategory } from '@/lib/new-entry/graphql';
import { accountOptions, categoryOptions } from '@/lib/new-entry/options';
import { AmountField } from './amount-field';

/** Gasto or ingreso: amount, account, date, merchant, category, receipt. */
export function EntryForm({
  draft,
  onChange,
  accounts,
  categories,
  errors,
  file,
  onFileChange,
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
  file: File | null;
  onFileChange: (file: File | null) => void;
  busy: boolean;
  busyLabel: string;
  submitError: string | null;
  onSubmit: () => void;
}) {
  const t = useTranslations('newEntry');
  const locale = useLocale();
  const today = todayKey();

  const accountItems = React.useMemo(
    () => accountOptions(accounts),
    [accounts],
  );
  const categoryItems = React.useMemo(
    () => categoryOptions(categories, draft.type, locale),
    [categories, draft.type, locale],
  );

  // Preselect the category the merchant's history suggests, unless the
  // user already chose one.
  const suggestedId = useCategorySuggestion(draft.merchant);
  React.useEffect(() => {
    const next = applySuggestedCategory(draft, suggestedId);
    if (next !== draft) onChange(next);
  }, [draft, suggestedId, onChange]);
  const showSuggested =
    !draft.categoryPicked &&
    suggestedId !== null &&
    draft.categoryId === suggestedId;

  const set = (patch: Partial<EntryDraft>) => onChange({ ...draft, ...patch });
  const isExpense = draft.type === 'expense';

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="flex flex-col gap-4"
    >
      <AmountField
        value={draft.amount}
        onChange={(amount) => set({ amount })}
        currency={currencyOf(accounts, draft.accountId)}
        error={errors.amount && t(`validation.${errors.amount}`)}
        autoFocus
      />
      <Combobox
        label={t('fields.account')}
        options={accountItems}
        value={draft.accountId}
        onChange={(accountId) => set({ accountId })}
        placeholder={t('fields.accountPlaceholder')}
        searchPlaceholder={t('fields.accountSearch')}
        emptyText={t('fields.accountEmpty')}
        error={errors.accountId && t(`validation.${errors.accountId}`)}
      />
      <DatePicker
        label={t('fields.date')}
        value={draft.date}
        onChange={(date) => set({ date })}
        max={today}
        locale={locale}
        placeholder={t('fields.datePlaceholder')}
        required
        error={errors.date && t(`validation.${errors.date}`)}
      />
      <Input
        label={
          isExpense ? t('fields.merchantExpense') : t('fields.merchantIncome')
        }
        placeholder={
          isExpense
            ? t('fields.merchantExpensePlaceholder')
            : t('fields.merchantIncomePlaceholder')
        }
        value={draft.merchant}
        onChange={(e) => set({ merchant: e.target.value })}
        maxLength={120}
        autoComplete="off"
      />
      <div className="flex flex-col gap-1">
        <Combobox
          label={t('fields.category')}
          options={categoryItems}
          value={draft.categoryId}
          onChange={(categoryId) => set({ categoryId, categoryPicked: true })}
          placeholder={t('fields.categoryPlaceholder')}
          searchPlaceholder={t('fields.categorySearch')}
          emptyText={t('fields.categoryEmpty')}
          clearable
        />
        {showSuggested ? (
          <p className="flex items-center gap-1 text-xs text-on-surface-variant">
            <Sparkles aria-hidden className="size-3.5 text-violet-ink" />
            {t('fields.categorySuggested')}
          </p>
        ) : null}
      </div>
      <Textarea
        label={t('fields.note')}
        placeholder={t('fields.notePlaceholder')}
        value={draft.note}
        onChange={(e) => set({ note: e.target.value })}
        rows={2}
        maxLength={500}
      />
      <div className="flex flex-col gap-1">
        <Label>{t('fields.attachment')}</Label>
        <FileDropzone
          accept={ATTACHMENT_ACCEPT}
          maxSizeBytes={MAX_UPLOAD_BYTES}
          value={file ? [file] : []}
          onChange={(files) => onFileChange(files[0] ?? null)}
          title={t('fields.attachmentTitle')}
          description={t('fields.attachmentHint')}
          dragActiveText={t('fields.attachmentDragActive')}
          removeLabel={(name) => t('fields.attachmentRemove', { name })}
          tooLargeText={(name, max) =>
            t('fields.attachmentTooLarge', { name, max })
          }
          wrongTypeText={(name) => t('fields.attachmentWrongType', { name })}
          className="[&>button]:min-h-24 [&>button]:py-4"
        />
      </div>
      {submitError ? (
        <p role="alert" className="text-sm text-expense">
          {submitError}
        </p>
      ) : null}
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? busyLabel : t(`submit.${draft.type}`)}
      </Button>
    </form>
  );
}
