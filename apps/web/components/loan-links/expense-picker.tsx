'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';

import { Badge } from '@finnit/ui/components/ui/badge';
import { Button } from '@finnit/ui/components/ui/button';
import { InputWithIcon } from '@finnit/ui/components/ui/input-with-icon';

import type { DayKey } from '@finnit/core/finance/dates';
import {
  buildExpenseCandidateRows,
  loadLoanExpenseCandidates,
  type ExpenseCandidateRow,
} from '@finnit/core/debts/links';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import { ChoiceOption } from './choice-option';

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; rows: ExpenseCandidateRow[] };

const SEARCH_DELAY_MS = 300;

/**
 * The expenses a loan payment can take: close in amount and date (those
 * naming the loan first), or what a search by description finds. The first
 * match comes selected when it names the loan with the same amount.
 */
export function ExpensePicker({
  occurrenceId,
  today,
  value,
  onChange,
}: {
  occurrenceId: string;
  today: DayKey;
  value: string | null;
  onChange: (transactionId: string | null) => void;
}) {
  const l = useLocalizer();
  const tl = useTranslations('debts.links');
  const [search, setSearch] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [state, setState] = React.useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = React.useState(0);
  const changeRef = React.useRef(onChange);
  React.useEffect(() => {
    changeRef.current = onChange;
  });
  const chosen = React.useRef(value !== null);

  React.useEffect(() => {
    const timer = window.setTimeout(
      () => setQuery(search.trim()),
      SEARCH_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [search]);

  React.useEffect(() => {
    let live = true;
    setState({ status: 'loading' });
    loadLoanExpenseCandidates(occurrenceId, query || null, gql)
      .then((found) => {
        if (!live) return;
        const rows = buildExpenseCandidateRows(found, today, l);
        setState({ status: 'ready', rows });
        const first = rows[0];
        if (
          !chosen.current &&
          !query &&
          first?.nameMatch &&
          first.exactAmount
        ) {
          chosen.current = true;
          changeRef.current(first.transactionId);
        }
      })
      .catch(() => live && setState({ status: 'error' }));
    return () => {
      live = false;
    };
  }, [occurrenceId, query, today, l, attempt]);

  return (
    <div className="flex flex-col gap-3">
      <div role="search">
        <InputWithIcon
          iconLeft={Search}
          type="search"
          placeholder={tl('expense.search')}
          aria-label={tl('expense.searchLabel')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <p className="px-1 text-xs text-on-surface-variant">
        {query ? tl('expense.searchHint') : tl('expense.matchesHint')}
      </p>
      {state.status === 'loading' ? (
        <p className="px-1 text-sm text-on-surface-variant" aria-live="polite">
          {tl('loading')}
        </p>
      ) : state.status === 'error' ? (
        <p role="alert" className="flex items-center gap-2 px-1 text-sm">
          {tl('loadError')}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setAttempt((n) => n + 1)}
          >
            {tl('retry')}
          </Button>
        </p>
      ) : state.rows.length === 0 ? (
        <p className="px-1 text-sm text-on-surface-variant">
          {query ? tl('expense.emptySearch') : tl('expense.empty')}
        </p>
      ) : (
        <div
          role="radiogroup"
          aria-label={tl('expense.title')}
          className="flex flex-col gap-2"
        >
          {state.rows.map((row) => (
            <ChoiceOption
              key={row.transactionId}
              selected={value === row.transactionId}
              title={row.description}
              meta={row.meta}
              amount={row.amountLabel}
              badges={
                row.nameMatch || row.exactAmount ? (
                  <>
                    {row.nameMatch ? (
                      <Badge variant="brand">{tl('expense.nameMatch')}</Badge>
                    ) : null}
                    {row.exactAmount ? (
                      <Badge variant="muted">{tl('expense.exactAmount')}</Badge>
                    ) : null}
                  </>
                ) : undefined
              }
              onSelect={() => {
                chosen.current = true;
                onChange(row.transactionId);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
