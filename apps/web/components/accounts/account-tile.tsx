'use client';

import { useTranslations } from 'next-intl';

import { cn } from '@finnit/ui/lib/utils';

import type { AccountSummary } from '@/lib/accounts/view';
import { AccountCardVisual } from './account-card-visual';
import { AccountStatusBadge } from './account-status-badge';

/** One account in the list: its card, nickname, status and balance or debt. */
export function AccountTile({
  account,
  selected,
  holderName,
  onSelect,
}: {
  account: AccountSummary;
  selected: boolean;
  holderName: string;
  onSelect: () => void;
}) {
  const t = useTranslations('accounts');
  // The account's own name under a nickname, and the last digits unless
  // the name already ends with them ("BBVA Débito •1234").
  const shownName = account.label !== account.name ? account.name : null;
  const subtitle = [
    shownName,
    account.last4 && !(shownName ?? account.label).includes(account.last4)
      ? `•${account.last4}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      className={cn(
        'flex w-[84vw] max-w-[360px] shrink-0 snap-start flex-col gap-2 sm:w-[340px] lg:w-auto lg:max-w-none',
        account.archived && 'opacity-70',
      )}
    >
      <div aria-current={selected ? 'true' : undefined}>
        <AccountCardVisual
          account={account}
          primaryColor={account.primaryColor}
          secondaryColor={account.secondaryColor}
          holderName={holderName}
          onClick={onSelect}
          className={cn('max-w-none', selected && 'ring-[3px] ring-brand/60')}
        />
      </div>
      <div className="flex items-start justify-between gap-2 px-1">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-on-background">
            {account.label}
          </p>
          {subtitle ? (
            <p className="truncate text-xs text-on-surface-variant">
              {subtitle}
            </p>
          ) : null}
        </div>
        <AccountStatusBadge
          linked={account.linked}
          archived={account.archived}
        />
      </div>
      <p
        className={cn(
          'px-1 text-sm font-bold',
          account.credit && account.credit.owed > 0
            ? 'text-expense'
            : 'text-on-background',
        )}
      >
        {account.credit
          ? t('tile.owed', { amount: account.balance })
          : t('tile.available', { amount: account.balance })}
      </p>
    </div>
  );
}
