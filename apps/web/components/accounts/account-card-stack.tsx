'use client';

import { cn } from '@finnit/ui/lib/utils';

import type { AccountSummary } from '@/lib/accounts/view';
import { AccountCardVisual } from './account-card-visual';

/** Height of a BankPaymentCard. */
const CARD_HEIGHT = 210;
/** How much of each stacked card shows: its type and bank name. */
const PEEK = 72;
/** Space between the stack and the active card. */
const GAP = 16;

/**
 * Every account as a stack of cards, wallet style: the others show only
 * their top edge, and the active one sits whole at the bottom. Choosing a
 * card slides it down and the previous one back into its place.
 */
export function AccountCardStack({
  accounts,
  activeId,
  holderName,
  label,
  onSelect,
}: {
  accounts: ReadonlyArray<AccountSummary>;
  activeId: string;
  holderName: string;
  /** Accessible name of the list. */
  label: string;
  onSelect: (id: string) => void;
}) {
  const others = accounts.filter((a) => a.id !== activeId);
  const activeTop = others.length * PEEK + (others.length > 0 ? GAP : 0);

  return (
    <ul
      aria-label={label}
      className="relative mx-auto w-full max-w-[360px] motion-safe:transition-[height] motion-safe:duration-500 @3xl:mx-0"
      style={{ height: activeTop + CARD_HEIGHT }}
    >
      {accounts.map((account) => {
        const active = account.id === activeId;
        const slot = active ? others.length : others.indexOf(account);
        return (
          <li
            key={account.id}
            aria-current={active ? 'true' : undefined}
            // The cards are translucent: a solid backing keeps the ones below from
            // showing through.
            className="absolute inset-x-0 top-0 rounded-[28px] bg-background motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{
              transform: `translateY(${active ? activeTop : slot * PEEK}px)`,
              zIndex: slot + 1,
            }}
          >
            <AccountCardVisual
              account={account}
              primaryColor={account.primaryColor}
              secondaryColor={account.secondaryColor}
              holderName={holderName}
              onClick={() => onSelect(account.id)}
              className={cn(
                'max-w-none',
                active
                  ? 'shadow-[0_18px_40px_rgba(0,0,0,0.22)]'
                  : 'shadow-[0_-4px_16px_rgba(0,0,0,0.12)]',
                account.archived && 'opacity-70',
              )}
            />
          </li>
        );
      })}
    </ul>
  );
}
