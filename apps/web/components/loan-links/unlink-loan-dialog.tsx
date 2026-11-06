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

import { debtErrorMessage } from '@finnit/core/debts/api';
import { unlinkLoanPayment } from '@finnit/core/debts/links';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import { ChoiceOption } from './choice-option';

/**
 * "Desligar": takes the expense off a loan payment. The expense stays as a
 * plain one; the user says whether the payment goes back to open or stays
 * paid without a movement. Mounted while open.
 */
export function UnlinkLoanDialog({
  occurrenceId,
  onClose,
  onUnlinked,
}: {
  occurrenceId: string;
  onClose: () => void;
  onUnlinked: () => void;
}) {
  const exit = useDialogExit();
  const { t } = useLocalizer();
  const tl = useTranslations('debts.links.unlink');
  const [keepPaid, setKeepPaid] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await unlinkLoanPayment(occurrenceId, keepPaid, gql);
      exit.after(onUnlinked)();
    } catch (e) {
      setError(debtErrorMessage(e, t));
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
        className="sm:max-w-md"
      >
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{tl('title')}</DialogTitle>
            <DialogDescription>{tl('description')}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div
              role="radiogroup"
              aria-label={tl('title')}
              className="flex flex-col gap-2"
            >
              <ChoiceOption
                selected={!keepPaid}
                title={tl('reopen')}
                meta={tl('reopenHint')}
                onSelect={() => setKeepPaid(false)}
              />
              <ChoiceOption
                selected={keepPaid}
                title={tl('keepPaid')}
                meta={tl('keepPaidHint')}
                onSelect={() => setKeepPaid(true)}
              />
            </div>
            {error ? (
              <p role="alert" className="text-[13px] text-expense">
                {error}
              </p>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={saving}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" variant="secondary" disabled={saving}>
              {saving ? tl('saving') : tl('confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
