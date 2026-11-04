'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { Sheet, SheetContent } from '@finnit/ui/components/ui/sheet';

import { NewEntryFlow, type NewEntryAction } from './new-entry-flow';

/**
 * "Nuevo movimiento" from the "+" buttons: a bottom sheet on phones, a
 * centered panel on wide screens. While a save or an upload is running it
 * can't be dismissed.
 */
export function NewEntrySheet({
  open,
  onOpenChange,
  initialAction,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Open on a kind's form or the receipt scanner instead of the kind step. */
  initialAction?: NewEntryAction;
}) {
  const t = useTranslations();
  const [locked, setLocked] = React.useState(false);
  const close = React.useCallback(() => {
    setLocked(false);
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next && locked) return;
        if (!next) setLocked(false);
        onOpenChange(next);
      }}
    >
      <SheetContent
        side="bottom"
        closeLabel={t('common.close')}
        showCloseButton={!locked}
        className="mx-auto w-full max-w-lg px-4 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:bottom-6 lg:max-h-[calc(100dvh-3rem)] lg:rounded-card lg:border"
      >
        <NewEntryFlow
          onDone={close}
          onLockChange={setLocked}
          initialAction={initialAction}
        />
      </SheetContent>
    </Sheet>
  );
}
