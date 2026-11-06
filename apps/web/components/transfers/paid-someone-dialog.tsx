'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';

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
import { Input } from '@finnit/ui/components/ui/input';
import { useDialogExit } from '@finnit/ui/lib/use-dialog-exit';

import { gql, requestErrorMessage } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import type { EntryCategory } from '@/lib/new-entry/graphql';
import { categoryOptions } from '@/lib/new-entry/options';
import {
  RESOLVE_TRANSFER_SUGGESTION_MUTATION,
  type TransferSuggestionView,
} from '@/lib/transfers/suggestions';
import { RememberField } from './convert-transfer-dialog';

const CONCEPT_MAX = 80;

/**
 * "A otra persona": not a transfer between own accounts. It keeps its type
 * and gets a description (e.g. who it was for) and a category; with
 * "Recordar", future movements with the same text get them too.
 */
export function PaidSomeoneDialog({
  suggestion,
  categories,
  onClose,
  onSaved,
}: {
  suggestion: TransferSuggestionView;
  categories: EntryCategory[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const exit = useDialogExit();
  const ts = useTranslations('transfers.someone');
  const { t } = useLocalizer();
  const locale = useLocale();
  const incoming = suggestion.categoryKind === 'income';
  const [concept, setConcept] = React.useState('');
  const [categoryId, setCategoryId] = React.useState('');
  const [remember, setRemember] = React.useState(false);
  const [pattern, setPattern] = React.useState(suggestion.pattern);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const options = React.useMemo(
    () => categoryOptions(categories, suggestion.categoryKind, locale),
    [categories, suggestion.categoryKind, locale],
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!concept.trim() && !categoryId) {
      setError(ts('required'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await gql(RESOLVE_TRANSFER_SUGGESTION_MUTATION, {
        id: suggestion.id,
        input: {
          action: 'to_someone',
          description: concept.trim() || null,
          categoryId: categoryId || null,
          remember: remember && pattern.trim().length > 0,
          ...(remember && { pattern: pattern.trim() }),
        },
      });
      exit.after(onSaved)();
    } catch (e) {
      setError(requestErrorMessage(e, t));
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
        className="sm:max-w-lg"
      >
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{ts(incoming ? 'titleIn' : 'title')}</DialogTitle>
            <DialogDescription>
              {ts(incoming ? 'descriptionIn' : 'description')}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <p className="rounded-input bg-track p-3 text-xs break-words text-on-surface-variant">
              {suggestion.title} · {suggestion.amount}
            </p>
            <Input
              label={ts('concept')}
              value={concept}
              maxLength={CONCEPT_MAX}
              autoComplete="off"
              autoFocus
              placeholder={ts('conceptPlaceholder')}
              onChange={(e) => {
                setConcept(e.target.value);
                setError(null);
              }}
            />
            <Combobox
              label={ts('category')}
              options={options}
              value={categoryId || undefined}
              onChange={(id) => {
                setCategoryId(id ?? '');
                setError(null);
              }}
              placeholder={ts('categoryPlaceholder')}
              searchPlaceholder={ts('categorySearch')}
              emptyText={ts('noResults')}
              clearable
            />
            <RememberField
              remember={remember}
              pattern={pattern}
              hint={ts('rememberHint')}
              onRemember={setRemember}
              onPattern={setPattern}
            />
            {error ? (
              <p role="alert" className="text-sm text-expense">
                {error}
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
              {saving ? ts('saving') : ts('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
