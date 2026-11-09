import * as React from 'react';
import { useTranslations } from 'use-intl';

import {
  linkRecurringPayment,
  loadRecurringLinkOptions,
  linkIntro,
  toRecurringLinkOptions,
  type RecurringLinkOptionView,
} from '@finnit/core/recurring/links';
import { transactionErrorMessage } from '@finnit/core/transaction-detail/api';
import { TwScrollView } from '@finnit/ui-native/lib/tw';
import { Badge } from '@finnit/ui-native/components/ui/badge';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Sheet } from '@finnit/ui-native/components/ui/sheet';
import { Text } from '@finnit/ui-native/components/ui/text';

import { ChoiceRow } from '@/components/loan-links/choice-row';
import { useGql } from '@/lib/graphql/runner';
import { useLocalizer } from '@/lib/i18n/i18n-provider';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; options: RecurringLinkOptionView[] };

/**
 * "Ligar a gasto recurrente" (the web's LinkRecurringDialog): pick the
 * scheduled payment the expense covered; it is marked paid and the expense
 * takes its category. Mounted while open.
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
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let live = true;
    loadRecurringLinkOptions(transaction.id, gql)
      .then((raw) => {
        if (!live) return;
        const { options, initial } = toRecurringLinkOptions(
          raw,
          transaction.currency,
          l,
        );
        setState({ status: 'ready', options });
        setPicked(initial);
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
  }, [transaction.id, transaction.currency, gql, l]);

  const options = state.status === 'ready' ? state.options : [];
  const choice = options.find((o) => o.occurrenceId === picked) ?? null;

  async function save() {
    if (!choice) return;
    setSaving(true);
    setError(null);
    try {
      await linkRecurringPayment(transaction.id, choice.occurrenceId, gql);
      onLinked(choice.name);
    } catch (e) {
      setError(transactionErrorMessage(e, l.t));
      setSaving(false);
    }
  }

  return (
    <Sheet
      open
      onOpenChange={(next) => !next && !saving && onClose()}
      title={t('title')}
      description={t('description', linkIntro(transaction, l))}
      closeLabel={l.t('common.close')}
    >
      <TwScrollView
        keyboardShouldPersistTaps="handled"
        style={{ maxHeight: 520 }}
        contentContainerClassName="gap-2 pb-2"
      >
        {state.status === 'loading' ? (
          <Text className="text-sm text-on-surface-variant">
            {t('loading')}
          </Text>
        ) : null}
        {state.status === 'error' ? (
          <Text className="text-sm text-expense">{state.message}</Text>
        ) : null}
        {state.status === 'ready' && options.length === 0 ? (
          <Text className="text-sm text-on-surface-variant">{t('empty')}</Text>
        ) : null}
        {options.map((o) => (
          <ChoiceRow
            key={o.occurrenceId}
            selected={picked === o.occurrenceId}
            title={o.name}
            meta={o.detail}
            badges={
              o.proposed ? (
                <Badge label={t('proposed')} variant="brand" />
              ) : null
            }
            onPress={() => setPicked(o.occurrenceId)}
          />
        ))}
        {error ? <Text className="text-sm text-expense">{error}</Text> : null}
      </TwScrollView>
      <Button
        label={t('submit')}
        onPress={save}
        disabled={saving || !choice}
        className="mt-3 w-full"
      />
    </Sheet>
  );
}
