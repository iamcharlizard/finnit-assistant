'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { CalendarClock, Plus } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';

import { DebtList } from '@/components/debts/debt-list';
import { NewDebtDialog } from '@/components/debts/new-debt-dialog';
import { EmptyState } from '@/components/finance/empty-state';
import {
  CARD_PLANS_QUERY,
  cardPlansOf,
  cardPlansVariables,
  type CardPlansResult,
} from '@finnit/core/debts/card-plans';
import { buildDebtsView } from '@finnit/core/debts/view';
import { todayKey } from '@finnit/core/finance/dates';
import { gql, requestErrorMessage } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';

/**
 * A credit card's "Pagos a meses": its purchases in installments as cards
 * (like Deudas), each opening its schedule; and "Nueva compra a meses" with
 * the card already chosen.
 */
export function CardPlansTab({
  accountId,
  onChanged,
}: {
  accountId: string;
  /** A plan changed (what the card owes may too). */
  onChanged: () => void;
}) {
  const t = useTranslations('accounts.cardPlans');
  const l = useLocalizer();
  const today = todayKey();
  const [data, setData] = React.useState<CardPlansResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [version, setVersion] = React.useState(0);

  React.useEffect(() => {
    let live = true;
    gql<CardPlansResult>(CARD_PLANS_QUERY, cardPlansVariables())
      .then((result) => live && setData(result))
      .catch((e: unknown) => live && setError(requestErrorMessage(e, l.t)));
    return () => {
      live = false;
    };
  }, [version, l]);

  const reload = () => {
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
  if (!data) {
    return (
      <p className="text-sm text-on-surface-variant" aria-busy>
        {t('loading')}
      </p>
    );
  }

  const accounts = data.accounts.edges.map((e) => e.node);
  const plans = cardPlansOf(
    data.debts.edges.map((e) => e.node),
    accountId,
  );
  const view = buildDebtsView({ debts: plans, accounts }, { today }, l);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="px-1 text-sm text-on-surface-variant">
          {t('count', { count: plans.length })}
        </p>
        <Button variant="secondary" onClick={() => setCreating(true)}>
          <Plus aria-hidden /> {t('new')}
        </Button>
      </div>
      {plans.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
        />
      ) : (
        <DebtList
          items={view.debts}
          accounts={accounts}
          categories={data.categories}
          today={today}
          onChanged={reload}
        />
      )}
      {creating ? (
        <NewDebtDialog
          initialKind="card_installments"
          cardPrefill={{ accountId }}
          accounts={accounts}
          categories={data.categories}
          today={today}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            reload();
          }}
        />
      ) : null}
    </div>
  );
}
