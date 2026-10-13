'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Archive, ArchiveRestore } from 'lucide-react';

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
import { Button } from '@finnit/ui/components/ui/button';

import { accountErrorMessage, setAccountArchived } from '@/lib/accounts/api';
import { gql } from '@/lib/graphql/client';

/** Archive (after asking) or bring back an account. */
export function ArchiveAccountButton({
  accountId,
  label,
  archived,
  disabled,
  onDone,
  onError,
}: {
  accountId: string;
  label: string;
  archived: boolean;
  disabled?: boolean;
  onDone: (archived: boolean) => void;
  onError: (message: string) => void;
}) {
  const t = useTranslations();
  const [confirming, setConfirming] = React.useState(false);
  const [working, setWorking] = React.useState(false);

  async function run(next: boolean) {
    setWorking(true);
    try {
      await setAccountArchived(accountId, next, gql);
      onDone(next);
    } catch (error) {
      onError(accountErrorMessage(error, t));
    } finally {
      setWorking(false);
    }
  }

  if (archived) {
    return (
      <Button
        type="button"
        variant="outline"
        disabled={disabled || working}
        onClick={() => void run(false)}
      >
        <ArchiveRestore aria-hidden />
        {working
          ? t('accounts.archive.working')
          : t('accounts.archive.unarchive')}
      </Button>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        disabled={disabled || working}
        onClick={() => setConfirming(true)}
      >
        <Archive aria-hidden />
        {working
          ? t('accounts.archive.working')
          : t('accounts.archive.archive')}
      </Button>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('accounts.archive.confirmTitle', { name: label })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('accounts.archive.confirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction destructive onClick={() => void run(true)}>
              {t('accounts.archive.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
