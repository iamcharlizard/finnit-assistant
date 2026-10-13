'use client';

import { useTranslations } from 'next-intl';

import type { AccountGroup } from '@/lib/accounts/view';
import { AccountTile } from './account-tile';

/** A section of the list (credit cards, debit and cash, savings). */
export function AccountGroupSection({
  group,
  selectedId,
  holderName,
  onSelect,
}: {
  group: AccountGroup;
  selectedId: string | null;
  holderName: string;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations('cards');
  const headingId = `accounts-group-${group.key}`;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2
        id={headingId}
        className="px-1 text-[11px] font-medium uppercase tracking-[0.15em] text-on-surface-variant"
      >
        {group.title} · {group.accounts.length}
      </h2>
      <div
        aria-label={t('carouselLabel', { group: group.title })}
        className="-mx-4 flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-4 pt-1 pb-3 sm:mx-0 sm:px-0 lg:grid lg:grid-cols-2 lg:overflow-visible xl:grid-cols-3 [scrollbar-width:none]"
      >
        {group.accounts.map((account) => (
          <AccountTile
            key={account.id}
            account={account}
            selected={account.id === selectedId}
            holderName={holderName}
            onSelect={() => onSelect(account.id)}
          />
        ))}
      </div>
    </section>
  );
}
