'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Landmark,
  PiggyBank,
} from 'lucide-react';
import type {
  AccountChoice,
  ConnectedAccount,
  ConnectedBank,
} from '@finnit/bank-connect';

import { Button } from '@finnit/ui/components/ui/button';
import { BodyMd, TitleLg } from '@finnit/ui/components/ui/typography';

import {
  fetchFinnitAccounts,
  type FinnitAccount,
} from '@/lib/bank-connect/api';
import { DEFAULT_CURRENCY, formatMoney } from '@/lib/finance/money';
import { AccountChoiceSelect } from './account-choice-select';

/** Syncfy's account types → `bankConnect.accountTypes.<key>`. */
const ACCOUNT_TYPE_KEYS = {
  'Credit Card': 'creditCard',
  Checking: 'checking',
  Savings: 'savings',
  Investment: 'investment',
  Loan: 'loan',
} as const;

function accountTypeKey(type: string | null | undefined) {
  return type && Object.hasOwn(ACCOUNT_TYPE_KEYS, type)
    ? ACCOUNT_TYPE_KEYS[type as keyof typeof ACCOUNT_TYPE_KEYS]
    : null;
}

/** Cards and checking accounts are imported by default; empty savings are not. */
function defaultChoice(account: ConnectedAccount): AccountChoice {
  if (account.type === 'Savings' && !account.balance) return 'skip';
  return 'create';
}

function iconFor(type?: string | null) {
  if (type === 'Credit Card') return CreditCard;
  if (type === 'Savings') return PiggyBank;
  return Landmark;
}

export function LinkAccountsStep({
  bank,
  message,
  onSubmit,
}: {
  bank: ConnectedBank;
  message?: string;
  onSubmit: (choices: Record<string, AccountChoice>) => void;
}) {
  const t = useTranslations('bankConnect');
  const locale = useLocale();
  const [accounts, setAccounts] = React.useState<FinnitAccount[]>([]);
  const [choices, setChoices] = React.useState<Record<string, AccountChoice>>(
    () =>
      Object.fromEntries(bank.accounts.map((a) => [a.id, defaultChoice(a)])),
  );

  React.useEffect(() => {
    fetchFinnitAccounts().then(setAccounts, () => setAccounts([]));
  }, []);

  const toImport = bank.accounts.filter(
    (a) => !a.accountId && choices[a.id] !== 'skip',
  ).length;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <TitleLg as="h2">{t('link.title')}</TitleLg>
        <BodyMd className="mt-1 text-[13px] text-on-surface-variant">
          {t('link.found', {
            count: bank.accounts.length,
            bank: bank.institution ?? t('done.yourBank'),
          })}
        </BodyMd>
      </div>

      {message ? (
        <div
          role="alert"
          className="flex gap-2 rounded-xl border border-expense/30 bg-expense/10 p-3 text-[13px] text-expense"
        >
          <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
          {message}
        </div>
      ) : null}

      <ul className="flex flex-col gap-3">
        {bank.accounts.map((account) => {
          const Icon = iconFor(account.type);
          const selectId = `choice-${account.id}`;
          const typeKey = accountTypeKey(account.type);
          return (
            <li
              key={account.id}
              className="flex flex-col gap-3 rounded-xl bg-track p-4 sm:flex-row sm:items-center"
            >
              <Icon aria-hidden className="size-6 shrink-0 text-brand-ink" />
              <label htmlFor={selectId} className="flex-1">
                <span className="block text-sm font-medium text-on-background">
                  {account.name ?? t('link.accountFallback')}
                  {account.mask ? ` ·${account.mask}` : ''}
                </span>
                <span className="block text-xs text-on-surface-variant">
                  {typeKey ? t(`accountTypes.${typeKey}`) : account.type}
                  {typeof account.balance === 'number'
                    ? ` · ${formatMoney(account.balance, DEFAULT_CURRENCY, locale)}`
                    : ''}
                </span>
              </label>
              {account.accountId ? (
                <span className="flex items-center gap-1.5 text-sm text-income">
                  <CheckCircle2 aria-hidden className="size-4" />{' '}
                  {t('link.alreadyLinked')}
                </span>
              ) : (
                <AccountChoiceSelect
                  id={selectId}
                  value={choices[account.id] ?? 'skip'}
                  accounts={accounts}
                  onChange={(choice) =>
                    setChoices((c) => ({ ...c, [account.id]: choice }))
                  }
                />
              )}
            </li>
          );
        })}
      </ul>

      <Button
        variant="secondary"
        className="self-end"
        onClick={() => onSubmit(choices)}
      >
        {toImport ? t('link.import') : t('link.finish')}
      </Button>
    </div>
  );
}
