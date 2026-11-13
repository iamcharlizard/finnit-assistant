'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@finnit/ui/components/ui/alert-dialog';

export interface ConfirmRequest {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  /**
   * Another way out next to the confirmation (e.g. "Marcar como cancelado"
   * instead of deleting).
   */
  secondary?: { label: string; onConfirm: () => void };
}

/**
 * Asks before an action; `request` null keeps it closed. The last request
 * stays rendered while the dialog animates out.
 */
export function ConfirmDialog({
  request,
  onClose,
}: {
  request: ConfirmRequest | null;
  onClose: () => void;
}) {
  const t = useTranslations('common');
  const [shown, setShown] = React.useState(request);
  if (request && request !== shown) setShown(request);
  return (
    <AlertDialog open={request !== null} onOpenChange={(o) => !o && onClose()}>
      {shown ? (
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{shown.title}</AlertDialogTitle>
            <AlertDialogDescription>{shown.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            {shown.secondary ? (
              <AlertDialogAction onClick={shown.secondary.onConfirm}>
                {shown.secondary.label}
              </AlertDialogAction>
            ) : null}
            <AlertDialogAction
              destructive={shown.destructive}
              onClick={shown.onConfirm}
            >
              {shown.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      ) : null}
    </AlertDialog>
  );
}
