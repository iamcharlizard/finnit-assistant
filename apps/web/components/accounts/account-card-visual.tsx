'use client';

import { useTranslations } from 'next-intl';

import { BankPaymentCard } from '@finnit/ui/components/finance/bank-payment-card';

import type { AccountSummary } from '@finnit/core/accounts/view';

type CardFields = Pick<
  AccountSummary,
  | 'type'
  | 'tier'
  | 'label'
  | 'nickname'
  | 'bankName'
  | 'maskedNumber'
  | 'variant'
  | 'balance'
>;

/**
 * An account drawn as a card, with the user's colors when they chose some.
 * The title is the nickname when there is one, else the bank. Cards show
 * the holder; cash and savings show their balance instead.
 */
export function AccountCardVisual({
  account,
  primaryColor,
  secondaryColor,
  holderName,
  onClick,
  className,
}: {
  account: CardFields;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  holderName: string;
  onClick?: () => void;
  className?: string;
}) {
  const tu = useTranslations('ui.bankCard');
  const t = useTranslations('accounts');
  const isCard = account.type === 'credit' || account.type === 'debit';

  return (
    <BankPaymentCard
      variant={account.variant}
      primaryColor={primaryColor ?? undefined}
      secondaryColor={secondaryColor ?? undefined}
      cardTier={account.tier}
      bankName={account.nickname ?? account.bankName ?? account.label}
      maskedNumber={account.maskedNumber}
      holderName={isCard ? holderName.toUpperCase() : undefined}
      holderLabel={tu('holder')}
      expiryLabel={tu('expires')}
      balance={isCard ? undefined : account.balance}
      balanceLabel={t('cardBalance')}
      onClick={onClick}
      className={className}
    />
  );
}
