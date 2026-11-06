'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  ChevronDown,
  History,
  Loader2,
  LockKeyhole,
  Sparkles,
  Wand2,
} from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
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
import { Input } from '@finnit/ui/components/ui/input';
import { Textarea } from '@finnit/ui/components/ui/textarea';
import { useDialogExit } from '@finnit/ui/lib/use-dialog-exit';
import { cn } from '@finnit/ui/lib/utils';

import {
  AliasFields,
  AliasFormInvalid,
  useAliasEditor,
} from '@/components/aliases/alias-fields';
import { SwitchField } from '@/components/finance/switch-field';
import { AmountField } from '@/components/new-entry/amount-field';
import { aliasErrorMessage } from '@finnit/core/aliases/api';
import { aliasPatternGuess } from '@finnit/core/aliases/guess';
import type { ApiMerchantAlias } from '@finnit/core/aliases/types';
import {
  DISPLAY_NAME_MAX,
  privateByRule,
  renameChanged,
  renameFormOf,
  renameInput,
  validateRename,
  type NameSubject,
  type RenameForm,
} from '@finnit/core/categorize/rename';
import { todayKey } from '@finnit/core/finance/dates';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import { categoryOptions } from '@finnit/core/new-entry/options';
import {
  SET_ALIAS_MUTATION,
  similarCategory,
  suggestCategoryWithAi,
  transactionErrorMessage,
  updateTransaction,
} from '@finnit/core/transaction-detail/api';
import { ownNameUpdate, shownSuggestion } from '@finnit/core/transaction-detail/edit';
import {
  DESCRIPTION_MAX,
  MERCHANT_MAX,
  NOTES_MAX,
  buildUpdateInput,
  validateDetailForm,
  type DetailForm,
  type DetailFormErrors,
} from '@finnit/core/transaction-detail/form';
import type {
  DetailCategory,
  SimilarCategory,
} from '@finnit/core/transaction-detail/types';
import type { EditRules } from '@finnit/core/transaction-detail/view';

export interface EditSaved {
  /** False when nothing was different. */
  changed: boolean;
  /** An automatic name was created for the similar movements. */
  rule: ApiMerchantAlias | null;
}

/**
 * "Editar": everything the user can change on a movement, in one form.
 * Its name (own name, privacy, and an automatic name for the similar ones
 * in a section that opens right here), its category (with the one its
 * similar movements suggest, no AI), the fields the API lets it change
 * and its notes. Mounted while open, so it starts from the saved values.
 */
export function TransactionEditDialog({
  transactionId,
  initial,
  rules,
  subject,
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
  /** Its name as the name section sees it. */
  subject: NameSubject;
  currency: string;
  categories: DetailCategory[];
  categoryKind: 'expense' | 'income';
  isTransfer: boolean;
  onClose: () => void;
  onSaved: (saved: EditSaved) => void;
}) {
  // Closes with the exit animation before telling the parent.
  const exit = useDialogExit();
  const { t } = useLocalizer();
  const tt = useTranslations('transaction');
  const tf = useTranslations('transaction.form');
  const tn = useTranslations('transaction.name');
  const locale = useLocale();
  const today = todayKey();
  const fromBank = !rules.merchant;
  const byRule = privateByRule(subject);

  const [form, setForm] = React.useState(initial);
  const [errors, setErrors] = React.useState<DetailFormErrors>({});
  const [name, setName] = React.useState<RenameForm>(() =>
    renameFormOf(subject),
  );
  const [nameTooLong, setNameTooLong] = React.useState(false);
  const [makingRule, setMakingRule] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  // A rule already created by a save that failed later: not created twice.
  const createdRule = React.useRef<ApiMerchantAlias | null>(null);
  const editor = useAliasEditor({ alias: null, exampleIds: [subject.id] });

  const options = React.useMemo(
    () => categoryOptions(categories, categoryKind, locale),
    [categories, categoryKind, locale],
  );
  const similar = useSimilarCategory(transactionId, rules.category);
  const suggestion = shownSuggestion(similar, form.categoryId, options);
  const [aiBusy, setAiBusy] = React.useState(false);
  const [aiNote, setAiNote] = React.useState<string | null>(null);

  /**
   * Asks the AI for the category from the name being typed (else, for a
   * movement made by hand, its merchant or description; else the bank
   * text, on the server) and the amount. The answer is picked, not saved.
   */
  async function askAi() {
    setAiBusy(true);
    setAiNote(null);
    const typedName =
      name.displayName.trim() ||
      (rules.merchant
        ? form.merchantName.trim() || form.description.trim()
        : '');
    try {
      const found = await suggestCategoryWithAi(
        transactionId,
        typedName || null,
        gql,
      );
      const option = found.categoryId
        ? options.find((o) => o.value === found.categoryId)
        : undefined;
      if (option) {
        update({ categoryId: option.value });
        setAiNote(tf('aiPicked', { category: option.label }));
      } else {
        setAiNote(tf(found.aiUnavailable ? 'aiUnavailable' : 'aiNone'));
      }
    } catch (error) {
      setAiNote(transactionErrorMessage(error, t));
    } finally {
      setAiBusy(false);
    }
  }

  const update = (patch: Partial<DetailForm>) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      if ('amount' in patch) delete next.amount;
      if ('date' in patch) delete next.date;
      return next;
    });
  };

  /** Opens the automatic-name section, prefilled from this movement. */
  function toggleRule() {
    if (!makingRule) {
      editor.update({
        matchType: 'contains',
        pattern: editor.form.pattern || aliasPatternGuess(subject.original),
        displayName: editor.form.displayName || name.displayName.trim(),
        isPrivate: name.isPrivate || byRule,
      });
    }
    setMakingRule((open) => !open);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const found = validateDetailForm(form, rules, today);
    const badName = validateRename(name) !== null;
    setErrors(found);
    setNameTooLong(badName);
    if (Object.keys(found).length > 0 || badName) return;

    setSaving(true);
    setSubmitError(null);
    try {
      // 1. The automatic name, with this movement's category.
      let rule = createdRule.current;
      if (makingRule && !rule) {
        rule = await editor.save({
          categoryId: form.categoryId || undefined,
        });
        createdRule.current = rule;
      }
      // 2. The movement's own fields.
      const input = buildUpdateInput(form, initial, rules);
      if (input) await updateTransaction(transactionId, input, gql);
      // 3. Its own name and privacy.
      const own = ownNameUpdate({
        ruleCreated: rule !== null,
        hasOwnAlias: subject.hasOwnAlias,
        changed: renameChanged(subject, name),
        input: renameInput(name),
      });
      if (own) {
        await gql(SET_ALIAS_MUTATION, { id: transactionId, input: own });
      }
      exit.after(onSaved)({
        changed: Boolean(rule || input || own),
        rule,
      });
    } catch (error) {
      if (!(error instanceof AliasFormInvalid)) {
        setSubmitError(
          makingRule && !createdRule.current
            ? aliasErrorMessage(error, t)
            : transactionErrorMessage(error, t),
        );
      }
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
        className="sm:max-w-xl"
      >
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{tt('editTitle')}</DialogTitle>
            <DialogDescription>
              {fromBank
                ? tt('editImported')
                : isTransfer
                  ? tt('editTransfer')
                  : tt('editDescription')}
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            {/* Name and privacy */}
            <dl className="flex flex-col gap-2 rounded-input bg-track p-3 text-xs">
              <div>
                <dt className="font-medium text-on-surface-variant">
                  {tn('bankText')}
                </dt>
                <dd className="font-mono break-words text-on-background">
                  {subject.original ?? tn('bankTextHidden')}
                </dd>
              </div>
              {subject.rule ? (
                <div>
                  <dt className="font-medium text-on-surface-variant">
                    {tn('automatic')}
                  </dt>
                  <dd className="flex flex-wrap items-center gap-1 text-on-background">
                    {subject.rule.isProtected ? (
                      <LockKeyhole aria-hidden className="size-3.5" />
                    ) : null}
                    {subject.rule.displayName}
                    <Link
                      href="/settings/aliases"
                      className="font-medium text-brand-ink underline-offset-4 hover:underline"
                    >
                      {tn('seeRules')}
                    </Link>
                  </dd>
                </div>
              ) : null}
            </dl>

            <div className="flex flex-col gap-1">
              <Input
                label={tn('ownName')}
                value={name.displayName}
                maxLength={DISPLAY_NAME_MAX}
                autoComplete="off"
                placeholder={
                  subject.rule?.displayName ?? tn('ownNamePlaceholder')
                }
                onChange={(e) => {
                  setName((n) => ({ ...n, displayName: e.target.value }));
                  setNameTooLong(false);
                }}
                error={
                  nameTooLong
                    ? tn('tooLong', { max: DISPLAY_NAME_MAX })
                    : undefined
                }
              />
              <p className="px-1 text-xs text-on-surface-variant">
                {subject.rule ? tn('ownNameHintRule') : tn('ownNameHint')}
              </p>
            </div>

            {byRule ? (
              <p className="flex items-start gap-2 rounded-input bg-track p-3 text-xs text-on-surface-variant">
                <LockKeyhole aria-hidden className="mt-0.5 size-4 shrink-0" />
                {tn(
                  subject.rule?.isProtected
                    ? 'privateByProtectedRule'
                    : 'privateByRule',
                  { name: subject.rule?.displayName ?? '' },
                )}
              </p>
            ) : (
              <SwitchField
                label={tn('private')}
                hint={tn('privateHint')}
                checked={name.isPrivate}
                onCheckedChange={(isPrivate) =>
                  setName((n) => ({ ...n, isPrivate }))
                }
              />
            )}

            <section
              className={cn(
                'flex flex-col gap-4 rounded-input border border-outline p-3',
                makingRule && 'border-brand/40 bg-brand/5',
              )}
            >
              <button
                type="button"
                aria-expanded={makingRule}
                aria-controls="rule-section"
                disabled={saving}
                onClick={toggleRule}
                className="flex min-h-9 w-full items-center gap-2 text-left text-sm font-medium text-on-background disabled:opacity-60"
              >
                <Wand2 aria-hidden className="size-4 shrink-0" />
                <span className="flex-1">{tn('makeRule')}</span>
                <ChevronDown
                  aria-hidden
                  className={cn(
                    'size-4 shrink-0 transition-transform',
                    makingRule && 'rotate-180',
                  )}
                />
              </button>
              {makingRule ? (
                <div id="rule-section" className="flex flex-col gap-5">
                  <p className="text-xs text-on-surface-variant">
                    {tn('makeRuleHint')}{' '}
                    {name.displayName.trim() || subject.hasOwnAlias
                      ? tn('ruleDropsOwn')
                      : null}
                  </p>
                  <AliasFields
                    editor={editor}
                    categories={categories}
                    showCategory={false}
                  />
                  <p className="-mt-2 px-1 text-xs text-on-surface-variant">
                    {tn('ruleCategory')}
                  </p>
                </div>
              ) : (
                <p className="-mt-3 text-xs text-on-surface-variant">
                  {tn('makeRuleHint')}
                </p>
              )}
            </section>

            {/* Category */}
            {rules.category ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <Combobox
                      label={tf('category')}
                      options={options}
                      value={form.categoryId || undefined}
                      onChange={(categoryId) => {
                        update({ categoryId: categoryId ?? '' });
                        setAiNote(null);
                      }}
                      placeholder={tf('categoryPlaceholder')}
                      searchPlaceholder={tf('categorySearch')}
                      emptyText={tf('noResults')}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0 rounded-input"
                    aria-label={tf('aiSuggest')}
                    title={tf('aiSuggestHint')}
                    disabled={aiBusy || saving}
                    onClick={askAi}
                  >
                    {aiBusy ? (
                      <Loader2 aria-hidden className="animate-spin" />
                    ) : (
                      <Sparkles aria-hidden />
                    )}
                  </Button>
                </div>
                {aiNote ? (
                  <p
                    role="status"
                    className="px-1 text-xs text-on-surface-variant"
                  >
                    {aiNote}
                  </p>
                ) : null}
                {suggestion ? (
                  <button
                    type="button"
                    onClick={() =>
                      update({ categoryId: suggestion.categoryId })
                    }
                    aria-label={tf('suggestedApply', {
                      category: suggestion.label,
                    })}
                    className="inline-flex min-h-8 max-w-full items-center gap-1.5 self-start rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-medium text-brand-ink transition-colors hover:bg-brand/15 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <History aria-hidden className="size-3.5 shrink-0" />
                    <span className="truncate">
                      {tf('suggested', { category: suggestion.label })}
                    </span>
                    <span className="shrink-0 font-normal text-on-surface-variant">
                      ·{' '}
                      {suggestion.source === 'history'
                        ? tf('suggestedBy.history', {
                            count: suggestion.count,
                          })
                        : tf(`suggestedBy.${suggestion.source}`)}
                    </span>
                  </button>
                ) : null}
              </div>
            ) : null}

            {/* The movement's own data (made by hand) */}
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
              <Input
                label={tf('description')}
                value={form.description}
                maxLength={DESCRIPTION_MAX}
                autoComplete="off"
                placeholder={tf('descriptionPlaceholder')}
                onChange={(e) => update({ description: e.target.value })}
              />
            ) : null}

            {rules.notes ? (
              <Textarea
                label={tf('notes')}
                value={form.notes}
                maxLength={NOTES_MAX}
                rows={3}
                placeholder={tf('notesPlaceholder')}
                onChange={(e) => update({ notes: e.target.value })}
              />
            ) : null}

            {submitError ? (
              <p role="alert" className="text-sm text-expense">
                {submitError}
              </p>
            ) : null}
          </DialogBody>

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

/** similarCategory for the open editor (once; failures just hide the pill). */
function useSimilarCategory(
  transactionId: string,
  enabled: boolean,
): SimilarCategory | null {
  const [similar, setSimilar] = React.useState<SimilarCategory | null>(null);
  React.useEffect(() => {
    if (!enabled) return;
    let alive = true;
    similarCategory(transactionId, gql)
      .then((found) => alive && setSimilar(found))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [transactionId, enabled]);
  return similar;
}
