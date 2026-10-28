'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@finnit/ui/components/ui/button';
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
import {
  categorizeErrorMessage,
  renameTransaction,
} from '@/lib/categorize/api';
import {
  DISPLAY_NAME_MAX,
  renameFormOf,
  validateRename,
  type RenameError,
  type RenameForm,
} from '@/lib/categorize/rename';
import type { CategorizeTransaction } from '@/lib/categorize/types';
import type { CategorizeRow } from '@/lib/categorize/view';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';

/**
 * "Renombrar": a one-off name for one movement (no rule), optionally
 * private. Mounted while open, so it starts from the row's values.
 */
export function RenameDialog({
  row,
  onClose,
  onSaved,
}: {
  row: CategorizeRow;
  onClose: () => void;
  onSaved: (updated: CategorizeTransaction, removed: boolean) => void;
}) {
  const { t } = useLocalizer();
  const tr = useTranslations('categorize.renameDialog');
  const [form, setForm] = React.useState<RenameForm>(() => renameFormOf(row));
  const [error, setError] = React.useState<RenameError | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  async function save(value: RenameForm | 'remove') {
    if (value !== 'remove') {
      const found = validateRename(value);
      setError(found);
      if (found) return;
    }
    setSaving(true);
    setSubmitError(null);
    try {
      const updated = await renameTransaction(row.id, value, gql);
      onSaved(updated, value === 'remove');
    } catch (e) {
      setSubmitError(categorizeErrorMessage(e, t));
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent closeLabel={t('common.close')} className="sm:max-w-md">
        <form
          noValidate
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            void save(form);
          }}
        >
          <DialogHeader>
            <DialogTitle>{tr('title')}</DialogTitle>
            <DialogDescription>{tr('description')}</DialogDescription>
          </DialogHeader>

          {row.original ? (
            <p className="rounded-input bg-track p-3 text-xs break-words text-on-surface-variant">
              {tr('original', { text: row.original })}
            </p>
          ) : null}

          <Input
            label={tr('displayName')}
            value={form.displayName}
            maxLength={DISPLAY_NAME_MAX}
            autoComplete="off"
            autoFocus
            placeholder={tr('displayNamePlaceholder')}
            onChange={(e) => {
              setForm((f) => ({ ...f, displayName: e.target.value }));
              setError(null);
            }}
            error={
              error === 'required'
                ? tr('required')
                : error === 'tooLong'
                  ? tr('tooLong', { max: DISPLAY_NAME_MAX })
                  : undefined
            }
          />
          <SwitchField
            label={tr('private')}
            hint={tr('privateHint')}
            checked={form.isPrivate}
            onCheckedChange={(isPrivate) =>
              setForm((f) => ({ ...f, isPrivate }))
            }
          />

          {submitError ? (
            <p role="alert" className="text-sm text-expense">
              {submitError}
            </p>
          ) : null}

          <DialogFooter className="gap-2 sm:justify-between">
            {row.hasOwnAlias ? (
              <Button
                type="button"
                variant="destructive"
                disabled={saving}
                onClick={() => void save('remove')}
              >
                {tr('remove')}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={saving}>
                  {t('common.cancel')}
                </Button>
              </DialogClose>
              <Button type="submit" disabled={saving}>
                {saving ? tr('saving') : tr('save')}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
