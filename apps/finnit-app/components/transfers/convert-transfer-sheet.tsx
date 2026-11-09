import * as React from 'react';
import { useTranslations } from 'use-intl';

import { accountLabel } from '@finnit/core/finance/accounts';
import { dayKeyOf, shortDate } from '@finnit/core/finance/dates';
import { formatMoney } from '@finnit/core/finance/money';
import { transactionTitle } from '@finnit/core/finance/transactions';
import type { ApiTransaction } from '@finnit/core/finance/types';
import { requestErrorMessage } from '@finnit/core/graphql/request';
import type { EntryAccount } from '@finnit/core/new-entry/graphql';
import { accountOptions } from '@finnit/core/new-entry/options';
import {
  CONVERT_DATA_QUERY,
  CONVERT_TO_TRANSFER_MUTATION,
  candidatesIn,
  convertDirection,
  convertInput,
  convertTargets,
  initialConvertChoice,
  proposedCandidate,
  type ConvertData,
  type ConvertMode,
  type ConvertSource,
} from '@finnit/core/transfers/convert';
import { TwScrollView, TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Select } from '@finnit/ui-native/components/ui/select';
import { Sheet } from '@finnit/ui-native/components/ui/sheet';
import { Text } from '@finnit/ui-native/components/ui/text';

import { ChoiceRow } from '@/components/loan-links/choice-row';
import { useGql } from '@/lib/graphql/runner';
import { useLocalizer } from '@/lib/i18n/i18n-provider';

/** The keys of transfers.convert that transfers.cardPayment words its own way. */
const CARD_PAYMENT_COPY: ReadonlySet<string> = new Set([
  'title',
  'descriptionOut',
  'descriptionIn',
  'noAccounts',
  'toAccount',
  'fromAccount',
  'submit',
  'saving',
]);

/**
 * "Convertir en transferencia" and "Registrar como pago a tarjeta de
 * crédito" (the web's ConvertTransferDialog): the user picks the other
 * account (only cards when an expense pays one) and, when that account
 * already has the opposite movement, which one it was (any date, the
 * closest first; one within a week comes chosen); otherwise that side is
 * created. Mounted while open.
 */
export function ConvertTransferSheet({
  source,
  mode = 'transfer',
  onClose,
  onConverted,
}: {
  source: ConvertSource;
  mode?: ConvertMode;
  onClose: () => void;
  onConverted: () => void;
}) {
  const tt = useTranslations('transfers');
  const l = useLocalizer();
  const { t, locale } = l;
  const gql = useGql();
  const tc = (key: string, values?: Record<string, string>) =>
    tt(
      `${mode === 'cardPayment' && CARD_PAYMENT_COPY.has(key) ? 'cardPayment' : 'convert'}.${key}` as 'convert.title',
      values,
    );
  const [data, setData] = React.useState<{
    targets: EntryAccount[];
    candidates: ApiTransaction[];
  } | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [accountId, setAccountId] = React.useState<string | null>(null);
  const [candidateId, setCandidateId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const direction = convertDirection(source);

  React.useEffect(() => {
    let alive = true;
    gql<ConvertData>(CONVERT_DATA_QUERY, { id: source.id })
      .then((result) => {
        if (!alive) return;
        const targets = convertTargets(
          result.accounts.edges.map((edge) => edge.node),
          source,
          mode,
        );
        setData({ targets, candidates: result.transferCandidates });
        const start = initialConvertChoice(
          result.transferCandidates,
          targets,
          source,
        );
        // With a single possible account, it is already chosen.
        const only = targets.length === 1 ? targets[0]!.id : null;
        const chosen = start.accountId ?? only;
        setAccountId(chosen);
        setCandidateId(
          start.candidateId ??
            proposedCandidate(result.transferCandidates, chosen, source),
        );
      })
      .catch((e: unknown) => {
        if (alive) setLoadError(requestErrorMessage(e, t));
      });
    return () => {
      alive = false;
    };
  }, [source, mode, gql, t]);

  const options = React.useMemo(
    () =>
      data
        ? accountOptions(data.targets).map(({ value, label }) => ({
            value,
            label,
          }))
        : [],
    [data],
  );
  const inAccount = data ? candidatesIn(data.candidates, accountId) : [];
  const account = data?.targets.find((a) => a.id === accountId) ?? null;
  const amount = formatMoney(source.amount, source.currency, locale);

  function chooseAccount(id: string | null) {
    setAccountId(id);
    setCandidateId(
      data ? proposedCandidate(data.candidates, id, source) : null,
    );
    setError(null);
  }

  async function submit() {
    if (!accountId) {
      setError(tc('accountRequired'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await gql(CONVERT_TO_TRANSFER_MUTATION, {
        input: convertInput(source, accountId, candidateId),
      });
      onConverted();
    } catch (e) {
      setError(requestErrorMessage(e, t));
      setSaving(false);
    }
  }

  return (
    <Sheet
      open
      onOpenChange={(next) => !next && !saving && onClose()}
      title={tc('title')}
      description={tc(
        direction === 'out' ? 'descriptionOut' : 'descriptionIn',
        {
          amount,
        },
      )}
      closeLabel={t('common.close')}
    >
      {loadError ? (
        <Text className="text-sm text-expense">{loadError}</Text>
      ) : !data ? (
        <Text className="text-sm text-on-surface-variant">{tc('loading')}</Text>
      ) : data.targets.length === 0 ? (
        <Text className="text-sm text-on-surface-variant">
          {tc('noAccounts')}
        </Text>
      ) : (
        <TwScrollView
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: 460 }}
          contentContainerClassName="gap-3 pb-2"
        >
          <Select
            label={tc(direction === 'out' ? 'toAccount' : 'fromAccount')}
            options={options}
            value={accountId}
            onValueChange={chooseAccount}
            placeholder={tc('accountPlaceholder')}
            searchPlaceholder={tc('accountSearch')}
          />
          {account ? (
            inAccount.length > 0 ? (
              <TwView className="gap-2">
                <Text className="px-1 text-sm text-on-surface-variant">
                  {tc('found', { account: accountLabel(account) })}
                </Text>
                {inAccount.map((candidate) => (
                  <ChoiceRow
                    key={candidate.id}
                    selected={candidateId === candidate.id}
                    title={transactionTitle(candidate, t)}
                    meta={`${shortDate(dayKeyOf(candidate.txnDate), locale)} · ${formatMoney(candidate.amount, candidate.currency, locale)}`}
                    onPress={() => setCandidateId(candidate.id)}
                  />
                ))}
                <ChoiceRow
                  selected={candidateId === null}
                  title={tc('createInstead')}
                  meta={tc('createInsteadHint')}
                  onPress={() => setCandidateId(null)}
                />
              </TwView>
            ) : (
              <Text className="px-1 text-sm text-on-surface-variant">
                {tc(direction === 'out' ? 'willCreateIn' : 'willCreateOut', {
                  account: accountLabel(account),
                  amount,
                })}
              </Text>
            )
          ) : null}
        </TwScrollView>
      )}

      {error ? (
        <Text className="mt-2 text-sm text-expense">{error}</Text>
      ) : null}
      <Button
        label={saving ? tc('saving') : tc('submit')}
        onPress={() => void submit()}
        disabled={saving || !data || data.targets.length === 0}
        className="mt-3 w-full"
      />
    </Sheet>
  );
}
