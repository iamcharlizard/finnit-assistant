'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { Combobox } from '@finnit/ui/components/ui/combobox';
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

import { SwitchField } from '@/components/finance/switch-field';
import { SelectField } from '@/components/recurring/select-field';
import { useAliasPreview } from '@/hooks/use-alias-preview';
import { aliasErrorMessage, regexErrorOf, saveAlias } from '@/lib/aliases/api';
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
  onClose,
  onSaved,
}: {
  /** Null to create one. */
  alias: ApiMerchantAlias | null;
  categories: CategorizeCategory[];
  onClose: () => void;
  onSaved: (saved: ApiMerchantAlias, created: boolean) => void;
}) {
  const { t, locale } = useLocalizer();
  const tf = useTranslations('aliases.form');
  const [form, setForm] = React.useState<AliasForm>(() =>
    alias ? formOfAlias(alias) : newAliasForm(),
  );
  const [errors, setErrors] = React.useState<AliasFormErrors>({});
  const [patternApiError, setPatternApiError] = React.useState<string | null>(
    null,
  );
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const preview = useAliasPreview(form);
  const categoryItems = React.useMemo(
    () => categoryOptions(categories, 'expense', locale),
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

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const found = validateAliasForm(form);
    setErrors(found);
    if (hasErrors(found)) return;
    setSaving(true);
    setSubmitError(null);
    try {
      const saved = await saveAlias(form, alias?.id ?? null, gql);
      onSaved(saved, !alias);
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
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent
        closeLabel={t('common.close')}
        className="max-h-[92dvh] overflow-y-auto sm:max-w-xl"
      >
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>
              {alias ? tf('editTitle') : tf('createTitle')}
            </DialogTitle>
            <DialogDescription>{tf('description')}</DialogDescription>
          </DialogHeader>

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

          <SwitchField
            label={tf('private')}
            hint={tf('privateHint')}
            checked={form.isPrivate}
            onCheckedChange={(isPrivate) => update({ isPrivate })}
          />

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
                <Input
                  label={tf('priority')}
                  inputMode="numeric"
                  value={form.priority}
                  maxLength={5}
                  onChange={(e) =>
                    update({ priority: e.target.value.replace(/[^\d-]/g, '') })
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
