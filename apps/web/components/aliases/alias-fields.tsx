'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, LockKeyhole, Sparkles } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@finnit/ui/components/ui/button';
import { Combobox } from '@finnit/ui/components/ui/combobox';
import { Input } from '@finnit/ui/components/ui/input';
import { NumberInput } from '@finnit/ui/components/ui/number-input';

import { SwitchField } from '@/components/finance/switch-field';
import { SelectField } from '@/components/recurring/select-field';
import { useSessionUser } from '@/components/session-provider';
import { useAliasPreview } from '@/hooks/use-alias-preview';
import {
  aliasErrorMessage,
  regexErrorOf,
  saveAlias,
  suggestAliasPattern,
} from '@finnit/core/aliases/api';
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
} from '@finnit/core/aliases/form';
import { MATCH_TYPES, type ApiMerchantAlias } from '@finnit/core/aliases/types';
import type { CategorizeCategory } from '@finnit/core/categorize/types';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import { categoryOptions } from '@finnit/core/new-entry/options';
import { AliasPreview } from './alias-preview';

/** Thrown by `save` when the form is not valid (its errors are on screen). */
export class AliasFormInvalid extends Error {}

/**
 * The state of an automatic name (alias rule) being created or edited: the
 * form, its errors, the live preview and the AI pattern suggestion. Used
 * by the rule dialog and by the movement's editor (as a section).
 */
export function useAliasEditor({
  alias,
  initial,
  exampleIds,
}: {
  /** Null to create one. */
  alias: ApiMerchantAlias | null;
  /** Starting values for a new one (e.g. made from a movement). */
  initial?: Partial<AliasForm>;
  /** Movements the AI uses as examples ("Sugerir con IA"). */
  exampleIds?: string[];
}) {
  const { t } = useLocalizer();
  const tf = useTranslations('aliases.form');
  const [form, setForm] = React.useState<AliasForm>(() =>
    alias ? formOfAlias(alias) : newAliasForm(initial),
  );
  const [errors, setErrors] = React.useState<AliasFormErrors>({});
  const [patternApiError, setPatternApiError] = React.useState<string | null>(
    null,
  );
  const [suggesting, setSuggesting] = React.useState(false);
  const [suggestion, setSuggestion] = React.useState<string | null>(null);
  const preview = useAliasPreview(form, alias?.id ?? null);

  const update = React.useCallback((patch: Partial<AliasForm>) => {
    setForm((current) => ({ ...current, ...patch }));
    setErrors((current) => {
      const next = { ...current };
      if ('pattern' in patch || 'matchType' in patch) delete next.pattern;
      if ('displayName' in patch) delete next.displayName;
      if ('priority' in patch) delete next.priority;
      return next;
    });
    if ('pattern' in patch || 'matchType' in patch) setPatternApiError(null);
  }, []);

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

  /**
   * Validates and saves the rule (with `patch` applied, e.g. the movement's
   * category). Throws AliasFormInvalid when the form has errors and the
   * API's error otherwise; a regex error goes under the pattern.
   */
  async function save(patch: Partial<AliasForm> = {}) {
    const values = { ...form, ...patch };
    const found = validateAliasForm(values);
    setErrors(found);
    if (hasErrors(found)) throw new AliasFormInvalid();
    try {
      return await saveAlias(values, alias?.id ?? null, gql);
    } catch (error) {
      const regex = regexErrorOf(error);
      if (regex) {
        setPatternApiError(regex);
        throw new AliasFormInvalid();
      }
      throw error;
    }
  }

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

  // The API's regex message (from the preview or the save) goes under the field.
  const previewRegexError =
    preview.status === 'error' ? preview.regexError : null;
  const patternError =
    errorText(errors.pattern) ??
    patternApiError ??
    previewRegexError ??
    undefined;

  return {
    form,
    update,
    preview,
    save,
    examples,
    suggesting,
    suggestion,
    suggestPattern,
    patternError,
    displayNameError: errorText(errors.displayName),
    priorityError: errorText(errors.priority),
  };
}

export type AliasEditor = ReturnType<typeof useAliasEditor>;

/**
 * The fields of an automatic name: how it matches, the pattern (with the
 * AI suggestion and the live preview), its name, category, privacy and
 * PIN protection, and the advanced options. `showCategory` false: the
 * caller sets the category (the movement's editor uses the movement's).
 */
export function AliasFields({
  editor,
  categories,
  showCategory = true,
}: {
  editor: AliasEditor;
  categories: CategorizeCategory[];
  showCategory?: boolean;
}) {
  const { t, locale } = useLocalizer();
  const tf = useTranslations('aliases.form');
  const { privacy } = useSessionUser();
  const { form, update } = editor;
  const categoryItems = React.useMemo(
    () => categoryOptions(categories, 'any', locale),
    [categories, locale],
  );

  return (
    <>
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
          error={editor.patternError}
        />
        <p className="px-1 text-xs text-on-surface-variant">
          {tf('patternHint')}
        </p>
        {editor.examples.length ? (
          <div className="flex flex-col gap-1 px-1 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              disabled={editor.suggesting}
              onClick={editor.suggestPattern}
            >
              <Sparkles aria-hidden />
              {editor.suggesting
                ? tf('suggestion.running')
                : tf('suggestion.button')}
            </Button>
            <p className="text-[11px] text-on-surface-variant">
              {tf('suggestion.privacy')}
            </p>
            {editor.suggestion ? (
              <p role="status" className="text-xs text-on-background">
                {editor.suggestion}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <AliasPreview state={editor.preview} />

      <Input
        label={tf('displayName')}
        value={form.displayName}
        maxLength={DISPLAY_NAME_MAX}
        autoComplete="off"
        placeholder={tf('displayNamePlaceholder')}
        onChange={(e) => update({ displayName: e.target.value })}
        error={editor.displayNameError}
      />

      {showCategory ? (
        <>
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
        </>
      ) : null}

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
              onValueChange={(value) => update({ priority: value })}
              error={editor.priorityError}
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
    </>
  );
}
