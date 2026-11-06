import { useTranslations } from 'use-intl';

import type { AccountSummary } from '@finnit/core/accounts/view';
import { BankPaymentCard } from '@finnit/ui-native/components/finance/bank-payment-card';

/** An account drawn as a card, with the user's colors when they chose some. */
export function AccountCardVisual({
  account,
  holderName,
  onPress,
  shadow,
}: {
  account: AccountSummary;
  holderName: string;
  onPress?: () => void;
  shadow?: string;
}) {
  const tu = useTranslations('ui.bankCard');
  const t = useTranslations('accounts');
  const isCard = account.type === 'credit' || account.type === 'debit';
  return (
    <BankPaymentCard
      variant={account.variant}
      primaryColor={account.primaryColor ?? undefined}
      secondaryColor={account.secondaryColor ?? undefined}
      cardTier={account.tier}
      bankName={account.nickname ?? account.bankName ?? account.label}
      maskedNumber={account.maskedNumber}
      holderName={isCard ? holderName.toUpperCase() : undefined}
      holderLabel={tu('holder')}
      expiryLabel={tu('expires')}
      balance={isCard ? undefined : account.balance}
      balanceLabel={t('cardBalance')}
      onPress={onPress}
      shadow={shadow}
      dimmed={account.archived}
    />
  );
}
