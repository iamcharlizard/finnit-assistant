import { useTranslations } from 'use-intl';

import type { AccountSummary } from '@finnit/core/accounts/view';
import { TwView } from '@finnit/ui-native/lib/tw';
import { BANK_CARD_HEIGHT } from '@finnit/ui-native/components/finance/bank-payment-card';

import { AccountCardVisual } from './account-card-visual';

/** How much of each stacked card shows: its type and bank name. */
const PEEK = 72;

/**
 * Every account as a stack of cards, wallet style (the web's
 * AccountCardStack without a selected card): each shows its top edge, the
 * last one whole. A tap opens that account.
 */
export function AccountCardStack({
  accounts,
  holderName,
  onSelect,
}: {
  accounts: readonly AccountSummary[];
  holderName: string;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations('accounts');
  const height = Math.max(0, accounts.length - 1) * PEEK + BANK_CARD_HEIGHT;
  return (
    <TwView accessibilityLabel={t('title')} className="w-full self-center" style={{ height, maxWidth: 360 }}>
      {accounts.map((account, index) => (
        <TwView
          key={account.id}
          className="absolute inset-x-0 top-0 rounded-[28px] bg-background"
          style={{ transform: [{ translateY: index * PEEK }], zIndex: index + 1 }}
        >
          <AccountCardVisual
            account={account}
            holderName={holderName}
            onPress={() => onSelect(account.id)}
            shadow={index === accounts.length - 1 ? '0 18px 40px rgba(0,0,0,0.22)' : '0 -4px 16px rgba(0,0,0,0.12)'}
          />
        </TwView>
      ))}
    </TwView>
  );
}
