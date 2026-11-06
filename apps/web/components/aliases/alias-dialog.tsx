'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, LockKeyhole, Sparkles } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@finnit/ui/components/ui/button';
import { Combobox } from '@finnit/ui/components/ui/combobox';
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
import { useDialogExit } from '@finnit/ui/lib/use-dialog-exit';
import { Input } from '@finnit/ui/components/ui/input';
import { NumberInput } from '@finnit/ui/components/ui/number-input';

import { SwitchField } from '@/components/finance/switch-field';
import { SelectField } from '@/components/recurring/select-field';
import { useAliasPreview } from '@/hooks/use-alias-preview';
import {
  aliasErrorMessage,
  regexErrorOf,
  saveAlias,
  suggestAliasPattern,
} from '@/lib/aliases/api';
import { useSessionUser } from '@/components/session-provider';
import {
  DISPLAY_NAME_MAX,
  PATTERN_MAX,
  PRIORITY_MAX,
  PRIORITY_MIN,
  formOfAlias,
  hasErrors,
  newAliasForm,
  validateAliasForm,
  type AliasForm,
  type AliasFormErrorCode,
  type AliasFormErrors,
} from '@/lib/aliases/form';
import { MATCH_TYPES, type ApiMerchantAlias } from '@/lib/aliases/types';
import type { CategorizeCategory } from '@/lib/categorize/types';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import { categoryOptions } from '@/lib/new-entry/options';
import { AliasPreview } from './alias-preview';

/**
 * Create or edit an alias rule, with a live preview of the movements it
 * matches. Mounted while open, so it starts from the alias' values.
 */
export function AliasDialog({
  alias,
  categories,
  initial,
  exampleIds,
  onClose,
  onSaved,
}: {
  /** Null to create one. */
  alias: ApiMerchantAlias | null;
  categories: CategorizeCategory[];
  /** Starting values for a new one (e.g. made from a movement). */
  initial?: Partial<AliasForm>;
  /** Movements the AI uses as examples ("Sugerir con IA"). */
  exampleIds?: string[];
  onClose: () => void;
  onSaved: (saved: ApiMerchantAlias, created: boolean) => void;
}) {
  // Closes with the exit animation before telling the parent.
  const exit = useDialogExit();
  const { t, locale } = useLocalizer();
  const tf = useTranslations('aliases.form');
  const [form, setForm] = React.useState<AliasForm>(() =>
    alias ? formOfAlias(alias) : newAliasForm(initial),
  );
  const { privacy } = useSessionUser();
  const [suggesting, setSuggesting] = React.useState(false);
  const [suggestion, setSuggestion] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<AliasFormErrors>({});
  const [patternApiError, setPatternApiError] = React.useState<string | null>(
    null,
  );
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const preview = useAliasPreview(form, alias?.id ?? null);
  const categoryItems = React.useMemo(
    () => categoryOptions(categories, 'any', locale),
    [categories, locale],
  );

  const errorText = (code: AliasFormErrorCode | undefined) => {
    if (!code) return undefined;
    if (code === 'patternTooLong') {
      return t('aliases.validation.patternTooLong', { max: PATTERN_MAX });
    }
    if (code === 'displayNameTooLong') {
      return t('aliases.validation.displayNameTooLong', {
        max: DISPLAY_NAME_MAX,
      });
    }
    if (code === 'priority') {
      return t('aliases.validation.priority', {
        min: PRIORITY_MIN,
        max: PRIORITY_MAX,
      });
    }
    return t(`aliases.validation.${code}`);
  };

  function update(patch: Partial<AliasForm>) {
    setForm((current) => ({ ...current, ...patch }));
    setErrors((current) => {
      const next = { ...current };
      if ('pattern' in patch || 'matchType' in patch) delete next.pattern;
      if ('displayName' in patch) delete next.displayName;
      if ('priority' in patch) delete next.priority;
      return next;
    });
    if ('pattern' in patch || 'matchType' in patch) setPatternApiError(null);
  }

  // Examples for the AI: the movements given, else what the preview found.
  const examples = exampleIds?.length
    ? exampleIds
    : preview.status === 'ready'
      ? preview.preview.samples.slice(0, 10).map((s) => s.transactionId)
      : [];

  /** Asks the API (AI first) for a pattern that covers the example movements. */
  async function suggestPattern() {
    if (!examples.length) return;
    setSuggesting(true);
    setSuggestion(null);
    try {
      const found = await suggestAliasPattern(examples, gql);
      update({ matchType: found.matchType, pattern: found.pattern });
      setSuggestion(
        found.aiUnavailable
          ? tf('suggestion.noAi')
          : found.source === 'ai'
            ? found.explanation || tf('suggestion.ai')
            : tf('suggestion.heuristic'),
      );
    } catch (error) {
      setSuggestion(aliasErrorMessage(error, t));
    } finally {
      setSuggesting(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const found = validateAliasForm(form);
    setErrors(found);
    if (hasErrors(found)) return;
    setSaving(true);
    setSubmitError(null);
    try {
      const saved = await saveAlias(form, alias?.id ?? null, gql);
      exit.after(onSaved)(saved, !alias);
    } catch (error) {
      const regex = regexErrorOf(error);
      if (regex) setPatternApiError(regex);
      else setSubmitError(aliasErrorMessage(error, t));
      setSaving(false);
    }
  }

  // The API's regex message (from the preview or the save) goes under the field.
  const previewRegexError =
    preview.status === 'error' ? preview.regexError : null;
  const patternError =
    errorText(errors.pattern) ??
    patternApiError ??
    previewRegexError ??
    undefined;

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
            <DialogTitle>
              {alias ? tf('editTitle') : tf('createTitle')}
            </DialogTitle>
            <DialogDescription>{tf('description')}</DialogDescription>
          </DialogHeader>

          <DialogBody>
            <SelectField
              label={tf('matchType')}
              value={form.matchType}
              options={MATCH_TYPES.map((value) => ({
                value,
                label: t(`aliases.matchTypes.${value}`),
              }))}
              onChange={(matchType) => update({ matchType })}
              hint={tf(`matchTypeHints.${form.matchType}`)}
            />

            <div className="flex flex-col gap-1">
              <Input
                label={tf('pattern')}
                value={form.pattern}
                maxLength={PATTERN_MAX}
                autoComplete="off"
                spellCheck={false}
                className={form.matchType === 'regex' ? 'font-mono' : undefined}
                onChange={(e) => update({ pattern: e.target.value })}
                error={patternError}
              />
              <p className="px-1 text-xs text-on-surface-variant">
                {tf('patternHint')}
              </p>
              {examples.length ? (
                <div className="flex flex-col gap-1 px-1 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="self-start"
                    disabled={suggesting}
                    onClick={suggestPattern}
                  >
                    <Sparkles aria-hidden />
                    {suggesting
                      ? tf('suggestion.running')
                      : tf('suggestion.button')}
                  </Button>
                  <p className="text-[11px] text-on-surface-variant">
                    {tf('suggestion.privacy')}
                  </p>
                  {suggestion ? (
                    <p role="status" className="text-xs text-on-background">
                      {suggestion}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <AliasPreview state={preview} />

            <Input
              label={tf('displayName')}
              value={form.displayName}
              maxLength={DISPLAY_NAME_MAX}
              autoComplete="off"
              placeholder={tf('displayNamePlaceholder')}
              onChange={(e) => update({ displayName: e.target.value })}
              error={errorText(errors.displayName)}
            />

            <Combobox
              label={tf('category')}
              options={categoryItems}
              value={form.categoryId}
              onChange={(categoryId) => update({ categoryId })}
              placeholder={tf('categoryPlaceholder')}
              searchPlaceholder={tf('searchCategory')}
              emptyText={tf('noCategories')}
              clearable
            />
            <Link
              href="/settings/categories"
              className="-mt-3 self-start px-1 text-xs font-medium text-brand-ink underline-offset-4 hover:underline"
            >
              {tf('createCategory')}
            </Link>

            <SwitchField
              label={tf('private')}
              hint={tf('privateHint')}
              checked={form.isPrivate || form.isProtected}
              disabled={form.isProtected}
              onCheckedChange={(isPrivate) => update({ isPrivate })}
            />

            {privacy?.hasPin ? (
              <SwitchField
                label={tf('protected')}
                hint={tf('protectedHint')}
                checked={form.isProtected}
                onCheckedChange={(isProtected) => update({ isProtected })}
              />
            ) : (
              <p className="flex items-start gap-2 rounded-input bg-track p-3 text-xs text-on-surface-variant">
                <LockKeyhole aria-hidden className="mt-0.5 size-4 shrink-0" />
                <span>
                  {tf('protectedNoPin')}{' '}
                  <Link
                    href="/settings"
                    className="font-medium text-brand-ink underline-offset-4 hover:underline"
                  >
                    {tf('protectedCreatePin')}
                  </Link>
                </span>
              </p>
            )}

            <details className="group rounded-input border border-outline px-3 py-2">
              <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between text-sm font-medium text-on-background">
                {tf('advanced')}
                <ChevronDown
                  aria-hidden
                  className="size-4 transition-transform group-open:rotate-180"
                />
              </summary>
              <div className="flex flex-col gap-4 pt-3 pb-1">
                <div className="flex flex-col gap-1">
                  <NumberInput
                    allowNegative
                    maxDigits={4}
                    label={tf('priority')}
                    value={form.priority}
                    onValueChange={(value) =>
                      update({
                        priority: value,
                      })
                    }
                    error={errorText(errors.priority)}
                  />
                  <p className="px-1 text-xs text-on-surface-variant">
                    {tf('priorityHint')}
                  </p>
                </div>
                <SwitchField
                  label={tf('active')}
                  checked={form.active}
                  onCheckedChange={(active) => update({ active })}
                />
              </div>
            </details>

            {submitError ? (
              <p role="alert" className="text-sm text-expense">
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
            <Button type="submit" disabled={saving}>
              {saving ? tf('saving') : alias ? tf('save') : tf('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
