'use client';

import { useTranslations } from 'next-intl';
import {
  CalendarCheck,
  CreditCard,
  Gauge,
  Scissors,
  TrendingUp,
  Wallet,
} from 'lucide-react';

import type { AccountDetail, DateFact } from '@finnit/core/accounts/view';
import { AccountFacts } from './account-facts';
import { AccountStat } from './account-stat';

/**
 * The selected account in figures. Credit cards: limit, credit used,
 * month-end projection, cut-off and payment dates, statement amounts.
 * Other accounts: balance and month-end projection.
 */
export function AccountStats({ detail }: { detail: AccountDetail }) {
  const t = useTranslations('accounts.detail');
  const { account, projection } = detail;
  const credit = account.credit;

  const projectedHint =
    projection.pendingCount === 0
      ? t('projectedNone')
      : t(credit ? 'projectedCredit' : 'projectedDebit', {
          count: projection.pendingCount,
          amount: projection.pendingTotal,
        });
  const projected = (
    <AccountStat
      icon={TrendingUp}
      label={t('projected')}
      value={projection.amount}
      hint={projectedHint}
      tone={projection.short ? 'expense' : 'default'}
    />
  );

  const dateStat = (
    label: string,
    icon: typeof Scissors,
    fact: DateFact | null,
  ) => (
    <AccountStat
      icon={icon}
      label={label}
      value={fact?.date ?? t('notSet')}
      hint={fact?.relative ?? t('notSetHint')}
      muted={!fact}
    />
  );

  if (!credit) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <AccountStat
          icon={Wallet}
          label={t('balance')}
          value={account.balance}
          tone={account.amount < 0 ? 'expense' : 'default'}
        />
        {projected}
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 @4xl:grid-cols-3">
      <AccountStat
        icon={Gauge}
        label={t('limit')}
        value={detail.limit ?? t('noLimit')}
        hint={
          credit.available
            ? t('available', { amount: credit.available })
            : undefined
        }
        muted={!detail.limit}
      />
      <AccountStat
        icon={CreditCard}
        label={t('used')}
        value={account.balance}
        tone={credit.owed > 0 ? 'expense' : 'default'}
        progress={detail.usedPercent}
        hint={
          detail.usedPercent != null
            ? t('usedHint', { percent: detail.usedPercent })
            : undefined
        }
      />
      {projected}
      {dateStat(t('statementDate'), Scissors, detail.statementDate)}
      {dateStat(t('paymentDate'), CalendarCheck, detail.paymentDate)}
      <AccountFacts facts={detail.facts} />
    </div>
  );
}
