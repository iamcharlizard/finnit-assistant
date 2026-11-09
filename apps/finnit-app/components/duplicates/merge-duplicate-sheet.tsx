import * as React from 'react';
import { useTranslations } from 'use-intl';

import {
  duplicateCandidates,
  mergeTransactions,
  type MergeNameFrom,
} from '@finnit/core/duplicates/request';
import {
  mergePlan,
  toMergeSide,
  type MergeSide,
} from '@finnit/core/duplicates/view';
import type { ApiTransaction } from '@finnit/core/finance/types';
import { transactionErrorMessage } from '@finnit/core/transaction-detail/api';
import { cn } from '@finnit/ui-native/lib/utils';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Sheet } from '@finnit/ui-native/components/ui/sheet';
import { Text } from '@finnit/ui-native/components/ui/text';

import { ChoiceRow } from '@/components/loan-links/choice-row';
import { useGql } from '@/lib/graphql/runner';
import { useLocalizer } from '@/lib/i18n/i18n-provider';

/** Days apart two records of the same money may be (the API's window). */
const DAYS = 3;

/**
 * "Marcar como duplicado" (the web's MergeDuplicateDialog): pick the other
 * record (or come with it, from a suggestion), see which stays (the bank's)
 * and which goes, choose the name and merge.
 */
export function MergeDuplicateSheet({
  transaction,
  other: givenOther,
  onClose,
  onMerged,
}: {
  transaction: ApiTransaction;
  other?: ApiTransaction;
  onClose: () => void;
  /** With the id of the movement that stays. */
  onMerged: (keptId: string) => void;
}) {
  const l = useLocalizer();
  const gql = useGql();
  const td = useTranslations('duplicates.dialog');
  const tc = useTranslations('common');
  const [candidates, setCandidates] = React.useState<ApiTransaction[] | null>(
    givenOther ? [givenOther] : null,
  );
  const [otherId, setOtherId] = React.useState<string | null>(
    givenOther?.id ?? null,
  );
  const [picked, setPicked] = React.useState(Boolean(givenOther));
  const [nameFrom, setNameFrom] = React.useState<MergeNameFrom | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (givenOther) return;
    let live = true;
    duplicateCandidates(transaction.id, gql)
      .then((rows) => {
        if (!live) return;
        setCandidates(rows);
        if (rows.length === 1) setOtherId(rows[0]!.id);
      })
      .catch((e: unknown) => live && setError(transactionErrorMessage(e, l.t)));
    return () => {
      live = false;
    };
  }, [transaction.id, givenOther, gql, l.t]);

  const other = candidates?.find((c) => c.id === otherId) ?? null;
  const plan = other ? mergePlan(transaction, other, l) : null;
  const chosenName = nameFrom ?? plan?.defaultName ?? 'keep';

  async function merge() {
    if (!plan || plan.blocked) return;
    setSaving(true);
    setError(null);
    try {
      const kept = await mergeTransactions(
        { keepId: plan.keep.id, dropId: plan.drop.id, nameFrom: chosenName },
        gql,
      );
      onMerged(kept);
    } catch (e) {
      setError(transactionErrorMessage(e, l.t));
      setSaving(false);
    }
  }

  return (
    <Sheet
      open
      onOpenChange={(next) => !next && !saving && onClose()}
      title={td('title')}
      description={picked ? td('keepHint') : td('pickHint', { days: DAYS })}
      closeLabel={tc('close')}
    >
      <TwView className="gap-4">
        {!picked ? (
          candidates === null && !error ? (
            <Text className="text-sm text-on-surface-variant">
              {tc('loading')}
            </Text>
          ) : candidates && candidates.length > 0 ? (
            <TwView
              accessibilityRole="radiogroup"
              accessibilityLabel={td('pick')}
              className="gap-2"
            >
              <Text weight="medium" className="text-sm">
                {td('pick')}
              </Text>
              {candidates.map((candidate) => {
                const side = toMergeSide(candidate, l);
                return (
                  <ChoiceRow
                    key={candidate.id}
                    selected={candidate.id === otherId}
                    title={side.title}
                    meta={[side.date, side.origin, side.category].join(' · ')}
                    amount={side.amount}
                    onPress={() => setOtherId(candidate.id)}
                  />
                );
              })}
            </TwView>
          ) : candidates ? (
            <Text className="text-sm text-on-surface-variant">
              {td('none')}
            </Text>
          ) : null
        ) : plan ? (
          <>
            <TwView className="gap-2">
              <SideCard side={plan.drop} label={td('drop')} keep={false} />
              <SideCard side={plan.keep} label={td('keep')} keep />
            </TwView>
            {plan.blocked ? (
              <Text accessibilityRole="alert" className="text-sm text-expense">
                {td('bothBank')}
              </Text>
            ) : (
              <>
                {plan.names.length > 1 ? (
                  <TwView
                    accessibilityRole="radiogroup"
                    accessibilityLabel={td('name')}
                    className="gap-2"
                  >
                    <Text weight="medium" className="text-sm">
                      {td('name')}
                    </Text>
                    {plan.names.map((name) => (
                      <ChoiceRow
                        key={name.value}
                        selected={chosenName === name.value}
                        title={name.label}
                        meta={
                          name.value === 'keep'
                            ? plan.keep.origin
                            : plan.drop.origin
                        }
                        onPress={() => setNameFrom(name.value)}
                      />
                    ))}
                  </TwView>
                ) : null}
                <Text className="text-sm text-on-surface-variant">
                  {td('outcome', {
                    name: plan.drop.title,
                    amount: plan.drop.amount,
                    account: plan.drop.account,
                  })}
                </Text>
              </>
            )}
          </>
        ) : null}
        {error ? (
          <Text accessibilityRole="alert" className="text-sm text-expense">
            {error}
          </Text>
        ) : null}
        <TwView className="gap-2">
          {picked ? (
            <Button
              label={saving ? td('merging') : td('confirm')}
              disabled={saving || Boolean(plan?.blocked)}
              onPress={() => void merge()}
            />
          ) : (
            <Button
              label={td('next')}
              disabled={!other}
              onPress={() => setPicked(true)}
            />
          )}
          {picked && !givenOther ? (
            <Button
              variant="outline"
              label={td('back')}
              disabled={saving}
              onPress={() => setPicked(false)}
            />
          ) : null}
        </TwView>
      </TwView>
    </Sheet>
  );
}

function SideCard({
  side,
  label,
  keep,
}: {
  side: MergeSide;
  label: string;
  keep: boolean;
}) {
  return (
    <TwView
      className={cn(
        'gap-1 rounded-xl border p-3',
        keep ? 'border-income-40 bg-income-5' : 'border-outline bg-track',
      )}
    >
      <Text
        weight="bold"
        className={cn(
          'text-[11px] tracking-widest uppercase',
          keep ? 'text-income' : 'text-on-surface-variant',
        )}
      >
        {label}
      </Text>
      <Text weight="medium" numberOfLines={1} className="text-sm">
        {side.title}
      </Text>
      <Text weight="bold" className="text-sm">
        {side.amount}
      </Text>
      <Text numberOfLines={1} className="text-xs text-on-surface-variant">
        {[side.date, side.origin, side.category].join(' · ')}
      </Text>
    </TwView>
  );
}
