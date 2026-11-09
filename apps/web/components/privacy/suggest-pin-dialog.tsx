'use client';

import { useTranslations } from 'next-intl';
import { ShieldCheck } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@finnit/ui/components/ui/dialog';
import { useDialogExit } from '@finnit/ui/lib/use-dialog-exit';

import { useLocalizer } from '@/lib/i18n/client';

/**
 * After hiding the amounts without a privacy PIN: suggests creating one,
 * so nobody else can show them. Mounted while open.
 */
export function SuggestPinDialog({
  onCreate,
  onLater,
  onNever,
}: {
  onCreate: () => void;
  onLater: () => void;
  onNever: () => void;
}) {
  const exit = useDialogExit();
  const t = useTranslations('dashboard.amounts');
  const { t: translate } = useLocalizer();

  return (
    <Dialog
      open={exit.open}
      onOpenChange={(open) => !open && exit.close(onLater)}
    >
      <DialogContent
        onExitComplete={exit.onExitComplete}
        closeLabel={translate('common.close')}
        className="sm:max-w-sm"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck aria-hidden className="size-5 text-income" />
            {t('suggestTitle')}
          </DialogTitle>
          <DialogDescription>{t('suggestDescription')}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={() => exit.close(onCreate)}>
            {t('suggestCreate')}
          </Button>
          <Button variant="outline" onClick={() => exit.close(onLater)}>
            {t('suggestLater')}
          </Button>
          <Button variant="ghost" onClick={() => exit.close(onNever)}>
            {t('suggestNever')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
