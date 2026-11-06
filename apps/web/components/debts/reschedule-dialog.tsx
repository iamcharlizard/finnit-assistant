'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { Button } from '@finnit/ui/components/ui/button';
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
import { useDialogExit } from '@finnit/ui/lib/use-dialog-exit';

import { debtErrorMessage, rescheduleLoanPayment } from '@/lib/debts/api';
import type { ScheduleRow } from '@finnit/core/debts/detail-view';
import { isDayKey, type DayKey } from '@finnit/core/finance/dates';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';

/**
 * Moves one open payment of the loan to the day it is actually charged
 * (e.g. the 12th instead of the 15th); the rest keep their dates. Mounted
 * while open.
 */
export function RescheduleDialog({
  row,
  onClose,
  onSaved,
}: {
  row: ScheduleRow & { occurrenceId: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const exit = useDialogExit();
  const { t } = useLocalizer();
  const td = useTranslations('debts.detail');
  const locale = useLocale();
  const [day, setDay] = React.useState<DayKey | ''>(row.dueDate);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!isDayKey(day)) return;
    if (day === row.dueDate) {
      exit.close(onClose);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await rescheduleLoanPayment(row.occurrenceId, day, gql);
      exit.after(onSaved)();
    } catch (cause) {
      setError(debtErrorMessage(cause, t));
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
            <DialogTitle>{td('rescheduleTitle')}</DialogTitle>
            <DialogDescription>
              {td('rescheduleDescription', {
                amount: row.amountLabel,
                date: row.dateLabel,
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="flex flex-col gap-1">
              <DatePicker
                label={td('rescheduleDate')}
                value={day || undefined}
                onChange={(next) => setDay(next ?? '')}
                locale={locale}
                placeholder={td('datePlaceholder')}
                required
              />
              <p className="px-1 text-xs text-on-surface-variant">
                {td('rescheduleHint')}
              </p>
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
            <Button
              type="submit"
              variant="secondary"
              disabled={saving || !isDayKey(day)}
            >
              {saving ? td('saving') : td('rescheduleSave')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
