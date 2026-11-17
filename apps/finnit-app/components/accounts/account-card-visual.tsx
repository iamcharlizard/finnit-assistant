import { useTranslations } from 'use-intl';

import type { AccountSummary } from '@finnit/core/accounts/view';
import { BankPaymentCard } from '@finnit/ui-native/components/finance/bank-payment-card';

/** An account drawn as a card, with the user's colors when they chose some. */
export function AccountCardVisual({
  account,
  holderName,
  onPress,
  shadow,
  showAmount = false,
}: {
  account: AccountSummary;
  holderName: string;
  onPress?: () => void;
  shadow?: string;
  /** What it has (a card: what it owes) in the header, visible when stacked. */
  showAmount?: boolean;
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
      balance={isCard || showAmount ? undefined : account.balance}
      balanceLabel={t('cardBalance')}
      headerAmount={showAmount ? account.balance : undefined}
      headerAmountLabel={showAmount ? t(account.type === 'credit' ? 'cardOwed' : 'cardAvailable') : undefined}
      onPress={onPress}
      shadow={shadow}
      dimmed={account.archived}
    />
  );
}
