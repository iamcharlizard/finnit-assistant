import type { CardVariant } from '@finnit/ui/components/finance/bank-payment-card';

// TODO: replace with GraphQL (accounts module).
// Copied from apps/finnit-app/screens/cards.tsx.

export interface CardData {
  variant: CardVariant;
  tier: string;
  maskedNumber: string;
  holder: string;
  expiry: string;
}

export const CARDS: CardData[] = [
  {
    variant: 'premium',
    tier: 'PREMIUM',
    maskedNumber: '**** **** **** 8824',
    holder: 'ALEX NEUMANN',
    expiry: '12/28',
  },
  {
    variant: 'stealth',
    tier: 'STEALTH BLACK',
    maskedNumber: '**** **** **** 4012',
    holder: 'ALEX NEUMANN',
    expiry: '05/26',
  },
];

export const CREDIT_LIMIT = { used: 12450, total: 20000 };
