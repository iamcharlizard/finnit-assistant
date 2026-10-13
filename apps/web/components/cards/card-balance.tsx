import { useTranslations } from 'next-intl';

import { CreditLimitCard } from '@finnit/ui/components/finance/credit-limit-card';
import { Card } from '@finnit/ui/components/ui/card';

import type { CardSummary } from '@/lib/cards/view';

/** Credit used of the limit, or the debit account's balance. */
export function CardBalance({ card }: { card: CardSummary }) {
  const t = useTranslations('cards');
  const tu = useTranslations('ui.creditLimit');
  if (card.credit?.limit) {
    return (
      <div className="flex flex-col gap-2">
        <CreditLimitCard
          used={card.credit.owed}
          total={card.credit.limit}
          currency={card.currency}
          title={tu('title')}
          ofLabel={(total) => tu('of', { total })}
          progressLabel={(percent) => tu('used', { percent })}
        />
        {card.credit.available ? (
          <p className="px-1 text-xs text-on-surface-variant">
            {t('availableCredit', { amount: card.credit.available })}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <Card className="min-h-44 justify-between gap-2 rounded-[20px] p-4.5">
      <h3 className="text-[11px] font-medium uppercase tracking-[0.15em] text-on-surface-variant">
        {card.credit ? t('currentDebt') : t('availableBalance')}
      </h3>
      <p
        className={
          card.credit
            ? 'text-[28px] font-bold text-expense'
            : 'text-[28px] font-bold text-on-background'
        }
      >
        {card.balance}
      </p>
      {card.credit ? (
        <p className="text-xs text-on-surface-variant">{t('noLimit')}</p>
      ) : null}
    </Card>
  );
}
