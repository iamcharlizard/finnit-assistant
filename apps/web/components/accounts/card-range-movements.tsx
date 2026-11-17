'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { HistoryRow } from '@/components/history/history-row';
import {
  CARD_MOVEMENTS_QUERY,
  buildCardMovements,
  cardMovementsVariables,
  type CardMovementsResult,
  type CardMovementsView,
  type CardRange,
} from '@finnit/core/accounts/card-movements';
import { todayKey } from '@finnit/core/finance/dates';
import { gql, requestErrorMessage } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';

/**
 * A card's movements in a range (a cycle or a month), by day, with what was
 * spent and paid in it. Each movement opens its detail and has the
 * history's right-click actions.
 */
export function CardRangeMovements({
  accountId,
  range,
  creditCardIds,
  onChanged,
}: {
  accountId: string;
  range: CardRange;
  creditCardIds: ReadonlyArray<string>;
  /** A movement changed (the card's figures may too). */
  onChanged: () => void;
}) {
  const t = useTranslations('accounts.cardMovements');
  const l = useLocalizer();
  const [view, setView] = React.useState<CardMovementsView | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [version, setVersion] = React.useState(0);

  React.useEffect(() => {
    let live = true;
    setError(null);
    gql<CardMovementsResult>(
      CARD_MOVEMENTS_QUERY,
      cardMovementsVariables(accountId, range),
    )
      .then((data) => {
        if (!live) return;
        setView(
          buildCardMovements(data, { accountId, range, today: todayKey() }, l),
        );
      })
      .catch((e: unknown) => live && setError(requestErrorMessage(e, l.t)));
    return () => {
      live = false;
    };
  }, [accountId, range.from, range.to, version, l]); // eslint-disable-line react-hooks/exhaustive-deps

  const changed = () => {
    setVersion((n) => n + 1);
    onChanged();
  };

  if (error) {
    return (
      <p role="alert" className="text-sm text-expense">
        {error}
      </p>
    );
  }
  if (!view) {
    return (
      <p className="text-sm text-on-surface-variant" aria-busy>
        {t('loading')}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-3 gap-3 rounded-[20px] bg-surface p-4 text-sm">
        <div>
          <dt className="text-xs text-on-surface-variant">{t('count')}</dt>
          <dd className="font-bold text-on-background tabular-nums">
            {view.count}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-on-surface-variant">{t('spent')}</dt>
          <dd className="font-bold text-expense tabular-nums">{view.spent}</dd>
        </div>
        <div>
          <dt className="text-xs text-on-surface-variant">{t('paidIn')}</dt>
          <dd className="font-bold text-income tabular-nums">{view.paidIn}</dd>
        </div>
      </dl>
      {view.groups.length === 0 ? (
        <p className="text-sm text-on-surface-variant">{t('empty')}</p>
      ) : (
        view.groups.map((group) => (
          <section key={group.day} className="flex flex-col gap-2">
            <h3 className="px-1 text-xs font-medium text-on-surface-variant">
              {group.heading}
            </h3>
            <ul className="flex flex-col gap-2">
              {group.rows.map((row) => (
                <li key={row.id}>
                  <HistoryRow
                    row={row}
                    creditCardIds={creditCardIds}
                    onChanged={changed}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
      <Link
        href={view.historyHref}
        className="self-start px-1 text-sm font-medium text-income hover:underline"
      >
        {view.truncated ? t('seeAll') : t('openHistory')}
      </Link>
    </div>
  );
}
