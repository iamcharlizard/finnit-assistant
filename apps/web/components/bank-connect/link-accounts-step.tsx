'use client';

import * as React from 'react';
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
import { AccountChoiceSelect } from './account-choice-select';

const money = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 2,
});

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  'Credit Card': 'Tarjeta de crédito',
  Checking: 'Cuenta de cheques',
  Savings: 'Ahorro',
  Investment: 'Inversión',
  Loan: 'Préstamo',
};

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
        <TitleLg as="h2">¿Qué cuentas quieres importar?</TitleLg>
        <BodyMd className="mt-1 text-[13px] text-on-surface-variant">
          Encontramos {bank.accounts.length} cuenta(s) en{' '}
          {bank.institution ?? 'tu banco'}. Importaremos sus movimientos de los
          últimos 90 días y los mantendremos al día.
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
          return (
            <li
              key={account.id}
              className="flex flex-col gap-3 rounded-xl bg-track p-4 sm:flex-row sm:items-center"
            >
              <Icon aria-hidden className="size-6 shrink-0 text-brand-ink" />
              <label htmlFor={selectId} className="flex-1">
                <span className="block text-sm font-medium text-on-background">
                  {account.name ?? 'Cuenta'}
                  {account.mask ? ` ·${account.mask}` : ''}
                </span>
                <span className="block text-xs text-on-surface-variant">
                  {ACCOUNT_TYPE_LABELS[account.type ?? ''] ?? account.type}
                  {typeof account.balance === 'number'
                    ? ` · ${money.format(account.balance)}`
                    : ''}
                </span>
              </label>
              {account.accountId ? (
                <span className="flex items-center gap-1.5 text-sm text-income">
                  <CheckCircle2 aria-hidden className="size-4" /> Ya ligada
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
        {toImport ? 'Importar movimientos' : 'Terminar'}
      </Button>
    </div>
  );
}
