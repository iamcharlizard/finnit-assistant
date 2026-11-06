'use client';

import * as React from 'react';

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
import { Input } from '@finnit/ui/components/ui/input';
import { MoneyInput } from '@finnit/ui/components/ui/money-input';
import { useDialogExit } from '@finnit/ui/lib/use-dialog-exit';

import {
  accountErrorMessage,
  balanceDifference,
  balanceFromTyped,
  setAccountBalance,
} from '@/lib/accounts/api';
import type { AccountSummary } from '@finnit/core/accounts/view';
import { formatMoney } from '@finnit/core/finance/money';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import { parseAmount } from '@finnit/core/new-entry/form';

/**
 * Sets an account's balance to what the bank shows (credit cards: what is
 * owed). The API records the difference as an adjustment. Mounted while open.
 */
export function BalanceUpdateDialog({
  account,
  onClose,
  onSaved,
}: {
  account: AccountSummary;
  onClose: () => void;
  onSaved: () => void;
}) {
  const exit = useDialogExit();
  const { t, locale } = useLocalizer();
  const isCredit = account.type === 'credit';
  // The balance as the API stores it (credit cards: negative owed).
  const current = isCredit ? -account.amount : account.amount;
  const [typed, setTyped] = React.useState('');
  const [note, setNote] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const value = parseAmount(typed);
  const target = value === null ? null : balanceFromTyped(value, isCredit);
  const difference =
    target === null ? null : balanceDifference(current, target);
  const money = (n: number, sign?: 'always') =>
    formatMoney(n, account.currency, locale, sign ? { sign } : undefined);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (target === null || difference === null) {
      setError(t('accounts.balanceUpdate.required'));
      return;
    }
    if (difference === 0) {
      exit.close(onClose);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await setAccountBalance(
        account.id,
        { balance: target, description: note },
        gql,
      );
      exit.after(onSaved)();
    } catch (failure) {
      setError(
        accountErrorMessage(failure, t) || t('accounts.balanceUpdate.error'),
      );
    } finally {
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
            <DialogTitle>{t('accounts.balanceUpdate.title')}</DialogTitle>
            <DialogDescription>
              {t('accounts.balanceUpdate.description')}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <MoneyInput
                label={t(
                  isCredit
                    ? 'accounts.balanceUpdate.owed'
                    : 'accounts.balanceUpdate.balance',
                )}
                currency={account.currency}
                value={typed}
                autoFocus
                onValueChange={(next) => {
                  setTyped(next);
                  setError(null);
                }}
                error={error ?? undefined}
              />
              <p className="px-1 text-xs text-on-surface-variant">
                {t('accounts.balanceUpdate.current', {
                  amount: account.balance,
                })}
              </p>
              {difference !== null ? (
                <p
                  aria-live="polite"
                  className="px-1 text-sm font-semibold text-on-background"
                >
                  {difference === 0
                    ? t('accounts.balanceUpdate.noChange')
                    : t('accounts.balanceUpdate.difference', {
                        amount: money(difference, 'always'),
                      })}
                </p>
              ) : null}
            </div>

            <Input
              label={t('accounts.balanceUpdate.note')}
              value={note}
              maxLength={120}
              autoComplete="off"
              placeholder={t('accounts.balanceUpdate.notePlaceholder')}
              onChange={(e) => setNote(e.target.value)}
            />

            {account.linked ? (
              <p className="px-1 text-xs text-on-surface-variant">
                {t('accounts.balanceUpdate.linkedHint')}
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
              {t('accounts.balanceUpdate.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
