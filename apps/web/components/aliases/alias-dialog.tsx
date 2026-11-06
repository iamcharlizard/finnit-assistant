'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@finnit/ui/components/ui/button';
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

import { aliasErrorMessage } from '@/lib/aliases/api';
import type { AliasForm } from '@/lib/aliases/form';
import type { ApiMerchantAlias } from '@/lib/aliases/types';
import type { CategorizeCategory } from '@/lib/categorize/types';
import { useLocalizer } from '@/lib/i18n/client';
import { AliasFields, AliasFormInvalid, useAliasEditor } from './alias-fields';

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
  /** Starting values for a new one. */
  initial?: Partial<AliasForm>;
  /** Movements the AI uses as examples ("Sugerir con IA"). */
  exampleIds?: string[];
  onClose: () => void;
  onSaved: (saved: ApiMerchantAlias, created: boolean) => void;
}) {
  // Closes with the exit animation before telling the parent.
  const exit = useDialogExit();
  const { t } = useLocalizer();
  const tf = useTranslations('aliases.form');
  const editor = useAliasEditor({ alias, initial, exampleIds });
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSubmitError(null);
    try {
      const saved = await editor.save();
      exit.after(onSaved)(saved, !alias);
    } catch (error) {
      if (!(error instanceof AliasFormInvalid)) {
        setSubmitError(aliasErrorMessage(error, t));
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
            <DialogTitle>
              {alias ? tf('editTitle') : tf('createTitle')}
            </DialogTitle>
            <DialogDescription>{tf('description')}</DialogDescription>
          </DialogHeader>

          <DialogBody>
            <AliasFields editor={editor} categories={categories} />

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
