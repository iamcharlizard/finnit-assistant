import * as React from 'react';
import { useTranslations } from 'use-intl';
import { Search } from 'lucide-react-native';

import { buildExpenseCandidateRows, loadLoanExpenseCandidates, type ExpenseCandidateRow } from '@finnit/core/debts/links';
import type { DayKey } from '@finnit/core/finance/dates';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Badge } from '@finnit/ui-native/components/ui/badge';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Input } from '@finnit/ui-native/components/ui/input';
import { Text } from '@finnit/ui-native/components/ui/text';

import { useGql } from '@/lib/graphql/runner';
import { useLocalizer } from '@/lib/i18n/i18n-provider';
import { ChoiceRow } from './choice-row';

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; rows: ExpenseCandidateRow[] };

const SEARCH_DELAY_MS = 300;

/**
 * The expenses a loan payment can take (the web's ExpensePicker): close in
 * amount and date, those naming the loan first, or a search by description.
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
  const gql = useGql();
  const t = useTranslations('debts.links');
  const [search, setSearch] = React.useState('');
  const [query, setQuery] = React.useState('');
  const queryRef = React.useRef('');
  const [state, setState] = React.useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = React.useState(0);
  const changeRef = React.useRef(onChange);
  React.useEffect(() => {
    changeRef.current = onChange;
  });
  const chosen = React.useRef(value !== null);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      const next = search.trim();
      if (next === queryRef.current) return;
      queryRef.current = next;
      setState({ status: 'loading' });
      setQuery(next);
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search]);

  React.useEffect(() => {
    let live = true;
    loadLoanExpenseCandidates(occurrenceId, query || null, gql)
      .then((found) => {
        if (!live) return;
        const rows = buildExpenseCandidateRows(found, today, l);
        setState({ status: 'ready', rows });
        const first = rows[0];
        if (!chosen.current && !query && first?.nameMatch && first.exactAmount) {
          chosen.current = true;
          changeRef.current(first.transactionId);
        }
      })
      .catch(() => live && setState({ status: 'error' }));
    return () => {
      live = false;
    };
  }, [occurrenceId, query, today, l, gql, attempt]);

  return (
    <TwView className="gap-3">
      <Input icon={Search} placeholder={t('expense.search')} accessibilityLabel={t('expense.searchLabel')} value={search} onChangeText={setSearch} returnKeyType="search" />
      <Text className="px-1 text-xs text-on-surface-variant">{query ? t('expense.searchHint') : t('expense.matchesHint')}</Text>
      {state.status === 'loading' ? (
        <Text className="px-1 text-sm text-on-surface-variant">{t('loading')}</Text>
      ) : state.status === 'error' ? (
        <TwView className="flex-row items-center gap-2 px-1">
          <Text className="flex-1 text-sm">{t('loadError')}</Text>
          <Button size="sm" variant="outline" label={t('retry')} onPress={() => {
              setState({ status: 'loading' });
              setAttempt((n) => n + 1);
            }}
          />
        </TwView>
      ) : state.rows.length === 0 ? (
        <Text className="px-1 text-sm text-on-surface-variant">{query ? t('expense.emptySearch') : t('expense.empty')}</Text>
      ) : (
        <TwView accessibilityRole="radiogroup" className="gap-2">
          {state.rows.map((row) => (
            <ChoiceRow
              key={row.transactionId}
              selected={value === row.transactionId}
              title={row.description}
              meta={row.meta}
              amount={row.amountLabel}
              badges={
                row.nameMatch || row.exactAmount ? (
                  <>
                    {row.nameMatch ? <Badge variant="brand" label={t('expense.nameMatch')} /> : null}
                    {row.exactAmount ? <Badge variant="muted" label={t('expense.exactAmount')} /> : null}
                  </>
                ) : undefined
              }
              onPress={() => {
                chosen.current = true;
                onChange(row.transactionId);
              }}
            />
          ))}
        </TwView>
      )}
    </TwView>
  );
}
