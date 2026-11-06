import * as React from 'react';
import { useTranslations } from 'use-intl';
import { Sparkles } from 'lucide-react-native';

import {
  DISPLAY_NAME_MAX,
  privateByRule,
  renameChanged,
  renameFormOf,
  renameInput,
  validateRename,
  type NameSubject,
} from '@finnit/core/categorize/rename';
import type { DayKey } from '@finnit/core/finance/dates';
import { categoryOptions } from '@finnit/core/new-entry/options';
import {
  SET_ALIAS_MUTATION,
  similarCategory,
  transactionErrorMessage,
  updateTransaction,
} from '@finnit/core/transaction-detail/api';
import { shownSuggestion } from '@finnit/core/transaction-detail/edit';
import {
  DESCRIPTION_MAX,
  MERCHANT_MAX,
  NOTES_MAX,
  buildUpdateInput,
  validateDetailForm,
  type DetailForm,
  type DetailFormErrors,
} from '@finnit/core/transaction-detail/form';
import type { DetailCategory, SimilarCategory } from '@finnit/core/transaction-detail/types';
import type { EditRules } from '@finnit/core/transaction-detail/view';
import { TwPressable, TwScrollView, TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { DatePicker } from '@finnit/ui-native/components/ui/date-picker';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Input } from '@finnit/ui-native/components/ui/input';
import { MoneyInput } from '@finnit/ui-native/components/ui/money-input';
import { Select } from '@finnit/ui-native/components/ui/select';
import { Separator } from '@finnit/ui-native/components/ui/separator';
import { Sheet } from '@finnit/ui-native/components/ui/sheet';
import { Switch } from '@finnit/ui-native/components/ui/switch';
import { Text } from '@finnit/ui-native/components/ui/text';

import { useGql } from '@/lib/graphql/runner';
import { useLocalizer } from '@/lib/i18n/i18n-provider';

/**
 * Editing a movement (the web's transaction-edit-dialog): its own name and
 * privacy, the category (with the "Sugerida" pill from the user's own
 * patterns), and the data the rules allow: amount, date, merchant,
 * description, notes.
 */
export function TransactionEditSheet({
  open,
  transactionId,
  initial,
  rules,
  subject,
  currency,
  categories,
  categoryKind,
  isTransfer,
  imported,
  today,
  onClose,
  onSaved,
}: {
  open: boolean;
  transactionId: string;
  initial: DetailForm;
  rules: EditRules;
  subject: NameSubject;
  currency: string;
  categories: DetailCategory[];
  categoryKind: 'expense' | 'income';
  isTransfer: boolean;
  imported: boolean;
  today: DayKey;
  onClose: () => void;
  onSaved: (changed: boolean) => void;
}) {
  const t = useTranslations('transaction');
  const tc = useTranslations('common');
  const l = useLocalizer();
  const gql = useGql();
  const [form, setForm] = React.useState(initial);
  const [name, setName] = React.useState(() => renameFormOf(subject));
  const [errors, setErrors] = React.useState<DetailFormErrors>({});
  const [saving, setSaving] = React.useState(false);
  const [failure, setFailure] = React.useState<string | null>(null);
  const [similar, setSimilar] = React.useState<SimilarCategory | null>(null);
  const byRule = privateByRule(subject);
  const nameError = validateRename(name);

  const options = React.useMemo(
    () =>
      categoryOptions(categories, categoryKind, l.locale).map((o) => ({
        value: o.value,
        label: o.label,
        hint: o.group && o.group !== o.label ? o.group : undefined,
      })),
    [categories, categoryKind, l.locale],
  );
  const suggestion = shownSuggestion(similar, form.categoryId, options);

  React.useEffect(() => {
    if (!open || !rules.category) return;
    let active = true;
    similarCategory(transactionId, gql)
      .then((s) => active && setSimilar(s))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [open, rules.category, transactionId, gql]);

  const set = <K extends keyof DetailForm>(key: K, value: DetailForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function save() {
    const next = validateDetailForm(form, rules, today);
    setErrors(next);
    if (Object.keys(next).length > 0 || nameError) return;
    setSaving(true);
    setFailure(null);
    try {
      const input = buildUpdateInput(form, initial, rules);
      const nameChanged = renameChanged(subject, name);
      if (input) await updateTransaction(transactionId, input, gql);
      if (nameChanged) await gql(SET_ALIAS_MUTATION, { id: transactionId, input: renameInput(name) });
      onSaved(Boolean(input) || nameChanged);
    } catch (error) {
      setFailure(transactionErrorMessage(error, l.t));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()} title={t('editTitle')} description={t('editDescription')} closeLabel={tc('close')}>
      <TwScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 560 }} contentContainerClassName="gap-4 pb-2">
        {imported ? <Text className="text-xs text-on-surface-variant">{t('editImported')}</Text> : null}
        {isTransfer ? <Text className="text-xs text-on-surface-variant">{t('editTransfer')}</Text> : null}

        <Input
          label={t('name.ownName')}
          value={name.displayName}
          onChangeText={(displayName) => setName((n) => ({ ...n, displayName }))}
          placeholder={subject.rule?.displayName ?? t('name.ownNamePlaceholder')}
          maxLength={DISPLAY_NAME_MAX + 10}
          error={nameError ? t('name.tooLong', { max: DISPLAY_NAME_MAX }) : undefined}
        />
        <Text className="-mt-2 px-1 text-xs text-on-surface-variant">
          {subject.rule ? t('name.ownNameHintRule') : t('name.ownNameHint')}
        </Text>
        <TwView className="flex-row items-center justify-between gap-3">
          <TwView className="min-w-0 flex-1">
            <Text weight="medium" className="text-sm">
              {t('name.private')}
            </Text>
            <Text className="text-xs text-on-surface-variant">
              {byRule
                ? t(subject.rule?.isProtected ? 'name.privateByProtectedRule' : 'name.privateByRule', {
                    name: subject.rule?.displayName ?? '',
                  })
                : t('name.privateHint')}
            </Text>
          </TwView>
          <Switch
            checked={name.isPrivate || byRule}
            disabled={byRule}
            onCheckedChange={(isPrivate) => setName((n) => ({ ...n, isPrivate }))}
            accessibilityLabel={t('name.private')}
          />
        </TwView>

        <Separator />

        {rules.category ? (
          <TwView className="gap-2">
            <Select
              label={t('form.category')}
              value={form.categoryId || null}
              options={options}
              onValueChange={(v) => set('categoryId', v)}
              placeholder={t('form.categoryPlaceholder')}
              searchable
              searchPlaceholder={t('form.categorySearch')}
              emptyLabel={t('form.noResults')}
              closeLabel={tc('close')}
            />
            {suggestion ? (
              <TwPressable
                accessibilityRole="button"
                accessibilityLabel={t('form.suggestedApply', { category: suggestion.label })}
                onPress={() => set('categoryId', suggestion.categoryId)}
                className="min-h-9 flex-row items-center gap-1.5 self-start rounded-full bg-primary-15 px-3"
              >
                <Icon icon={Sparkles} size={14} color="--brand-ink" />
                <Text weight="medium" className="text-sm">
                  {t('form.suggested', { category: suggestion.label })}
                </Text>
              </TwPressable>
            ) : null}
          </TwView>
        ) : null}

        {rules.amount ? (
          <MoneyInput
            label={t('form.amount')}
            value={form.amount}
            onValueChange={(amount) => set('amount', amount)}
            currency={currency}
            error={errors.amount ? t(`validation.${errors.amount}`) : undefined}
          />
        ) : null}
        {rules.date ? (
          <DatePicker
            label={t('form.date')}
            locale={l.locale}
            value={form.date}
            max={today}
            placeholder={t('form.datePlaceholder')}
            onChange={(date) => set('date', date ?? '')}
            error={errors.date ? t(`validation.${errors.date}`) : undefined}
            closeLabel={tc('close')}
          />
        ) : null}
        {rules.merchant ? (
          <Input
            label={t('form.merchant')}
            value={form.merchantName}
            onChangeText={(v) => set('merchantName', v)}
            placeholder={t('form.merchantPlaceholder')}
            maxLength={MERCHANT_MAX}
          />
        ) : null}
        {rules.description ? (
          <Input
            label={t('form.description')}
            value={form.description}
            onChangeText={(v) => set('description', v)}
            placeholder={t('form.descriptionPlaceholder')}
            maxLength={DESCRIPTION_MAX}
          />
        ) : null}
        {rules.notes ? (
          <Input
            label={t('form.notes')}
            value={form.notes}
            onChangeText={(v) => set('notes', v)}
            placeholder={t('form.notesPlaceholder')}
            maxLength={NOTES_MAX}
            multiline
            className="min-h-24 items-start"
            textAlignVertical="top"
          />
        ) : null}

        {failure ? (
          <Text accessibilityRole="alert" className="text-sm text-expense">
            {failure}
          </Text>
        ) : null}
        <Button label={saving ? t('form.saving') : t('form.save')} onPress={save} disabled={saving} className="w-full" />
      </TwScrollView>
    </Sheet>
  );
}
