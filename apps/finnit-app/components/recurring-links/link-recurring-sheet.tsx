import * as React from 'react';
import { useTranslations } from 'use-intl';
import { Search } from 'lucide-react-native';

import {
  initialLinkChoice,
  linkIntro,
  linkRecurringPayment,
  loadRecurringLinkOptions,
  toRecurringLinkView,
  type ApiRecurringLinkOptions,
  type RecurringLinkRow,
} from '@finnit/core/recurring/links';
import { transactionErrorMessage } from '@finnit/core/transaction-detail/api';
import { TwScrollView, TwView } from '@finnit/ui-native/lib/tw';
import { Badge } from '@finnit/ui-native/components/ui/badge';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Input } from '@finnit/ui-native/components/ui/input';
import { Select } from '@finnit/ui-native/components/ui/select';
import { Sheet } from '@finnit/ui-native/components/ui/sheet';
import { Text } from '@finnit/ui-native/components/ui/text';

import { ChoiceRow } from '@/components/loan-links/choice-row';
import { useGql } from '@/lib/graphql/runner';
import { useLocalizer } from '@/lib/i18n/i18n-provider';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; options: ApiRecurringLinkOptions };

/**
 * "Ligar a gasto recurrente" (the web's LinkRecurringDialog): the payment's
 * month (the expense's by default), the suggested recurring expenses and
 * the rest, with a search. Mounted while open.
 */
export function LinkRecurringSheet({
  transaction,
  onClose,
  onLinked,
}: {
  /** The expense: its id, amount, currency and day. */
  transaction: {
    id: string;
    amount: number;
    currency: string;
    txnDate: string;
  };
  onClose: () => void;
  onLinked: (name: string) => void;
}) {
  const t = useTranslations('transaction.linkRecurring');
  const l = useLocalizer();
  const gql = useGql();
  const [state, setState] = React.useState<State>({ status: 'loading' });
  const [picked, setPicked] = React.useState<string | null>(null);
  const [month, setMonth] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let live = true;
    loadRecurringLinkOptions(transaction.id, gql)
      .then((options) => {
        if (!live) return;
        const initial = initialLinkChoice(options);
        setState({ status: 'ready', options });
        setPicked(initial.id);
        setMonth(initial.month);
      })
      .catch(
        (e: unknown) =>
          live &&
          setState({
            status: 'error',
            message: transactionErrorMessage(e, l.t),
          }),
      );
    return () => {
      live = false;
    };
  }, [transaction.id, gql, l]);

  const options = state.status === 'ready' ? state.options : null;
  const view =
    options && month
      ? toRecurringLinkView(options, month, query, transaction.currency, l)
      : null;
  const rows = view ? [...view.suggested, ...view.others] : [];
  const choice = rows.find((r) => r.id === picked && !r.disabled) ?? null;

  async function save() {
    if (!choice || !month) return;
    setSaving(true);
    setError(null);
    try {
      await linkRecurringPayment(transaction.id, choice.id, month, gql);
      onLinked(choice.name);
    } catch (e) {
      setError(transactionErrorMessage(e, l.t));
      setSaving(false);
    }
  }

  const list = (title: string, items: RecurringLinkRow[]) =>
    items.length > 0 ? (
      <TwView className="gap-2">
        <Text
          weight="bold"
          className="px-1 text-xs uppercase tracking-wide text-on-surface-variant"
        >
          {title}
        </Text>
        {items.map((row) => (
          <ChoiceRow
            key={row.id}
            selected={picked === row.id}
            title={row.name}
            meta={row.detail}
            disabled={row.disabled}
            badges={
              row.id === options?.proposedId && row.suggested ? (
                <Badge label={t('proposed')} variant="brand" />
              ) : null
            }
            onPress={() => setPicked(row.id)}
          />
        ))}
      </TwView>
    ) : null;

  return (
    <Sheet
      open
      onOpenChange={(next) => !next && !saving && onClose()}
      title={t('title')}
      description={t('description', linkIntro(transaction, l))}
      closeLabel={l.t('common.close')}
    >
      {state.status === 'loading' ? (
        <Text className="text-sm text-on-surface-variant">{t('loading')}</Text>
      ) : null}
      {state.status === 'error' ? (
        <Text className="text-sm text-expense">{state.message}</Text>
      ) : null}
      {options && options.expenses.length === 0 ? (
        <Text className="text-sm text-on-surface-variant">{t('empty')}</Text>
      ) : null}
      {options && view && options.expenses.length > 0 ? (
        <TwView className="gap-3">
          <Select
            label={t('month')}
            options={view.months}
            value={month}
            onValueChange={setMonth}
            closeLabel={l.t('common.close')}
          />
          <Input
            icon={Search}
            placeholder={t('search')}
            accessibilityLabel={t('search')}
            value={query}
            onChangeText={setQuery}
          />
          <TwScrollView
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: 380 }}
            contentContainerClassName="gap-4 pb-2"
          >
            {rows.length === 0 ? (
              <Text className="text-sm text-on-surface-variant">
                {t('noResults')}
              </Text>
            ) : null}
            {list(t('suggestedTitle'), view.suggested)}
            {list(t('othersTitle'), view.others)}
          </TwScrollView>
        </TwView>
      ) : null}
      {error ? (
        <Text className="mt-2 text-sm text-expense">{error}</Text>
      ) : null}
      <Button
        label={t('submit')}
        onPress={() => void save()}
        disabled={saving || !choice}
        className="mt-3 w-full"
      />
    </Sheet>
  );
}
