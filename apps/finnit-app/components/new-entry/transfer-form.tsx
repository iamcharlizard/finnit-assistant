import * as React from 'react';
import { useTranslations } from 'use-intl';
import { CreditCard } from 'lucide-react-native';

import { accountLabel, creditOwed } from '@finnit/core/finance/accounts';
import { shortDate, todayKey, type DayKey } from '@finnit/core/finance/dates';
import { formatMoney } from '@finnit/core/finance/money';
import {
  currencyOf,
  type TransferDraft,
  type TransferErrors,
} from '@finnit/core/new-entry/form';
import type { EntryAccount } from '@finnit/core/new-entry/graphql';
import {
  isCardPayment,
  transferSources,
  cardPaymentTargets,
  transferTargets,
} from '@finnit/core/new-entry/options';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { DatePicker } from '@finnit/ui-native/components/ui/date-picker';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Input } from '@finnit/ui-native/components/ui/input';
import { Select } from '@finnit/ui-native/components/ui/select';
import { Text } from '@finnit/ui-native/components/ui/text';

import { toMergeSide } from '@finnit/core/duplicates/view';
import type { ApiTransaction } from '@finnit/core/finance/types';
import {
  NEW_LEG,
  TRANSFER_LEG_CANDIDATES_QUERY,
  legCandidatesArgs,
  legChoice,
  type TransferLegCandidates,
} from '@finnit/core/transfers/legs';

import { ChoiceRow } from '@/components/loan-links/choice-row';
import { useGql } from '@/lib/graphql/runner';
import { useLocale, useLocalizer } from '@/lib/i18n/i18n-provider';
import { AmountField } from './amount-field';

/** The user's pick for each side: a movement's id, NEW_LEG, or none yet. */
export type LegPicks = { from?: string; to?: string };

/** Transferencia between the user's accounts; into a credit card it is a card payment. */
export function TransferForm({
  draft,
  onChange,
  accounts,
  errors,
  busy,
  busyLabel,
  submitError,
  onSubmit,
  legs,
  onLegs,
  legPicks,
  onLegPick,
  cardDueDate,
  onlyCards = false,
}: {
  /** "Pago a tarjeta de crédito": the money can only go to a credit card. */
  onlyCards?: boolean;
  /** Paying a card's cycle: after this day it counts for the next one. */
  cardDueDate?: DayKey;
  /** Movements already recorded that may be its sides (null: not searched). */
  legs: TransferLegCandidates | null;
  onLegs: (legs: TransferLegCandidates | null) => void;
  legPicks: LegPicks;
  onLegPick: (side: 'from' | 'to', id: string) => void;
  draft: TransferDraft;
  onChange: (draft: TransferDraft) => void;
  accounts: EntryAccount[];
  errors: TransferErrors;
  busy: boolean;
  busyLabel: string;
  submitError: string | null;
  onSubmit: () => void;
}) {
  const t = useTranslations('newEntry');
  const tc = useTranslations('common');
  const { locale } = useLocale();
  const today = todayKey();
  const sources = React.useMemo(
    () =>
      transferSources(accounts).map(({ value, label }) => ({ value, label })),
    [accounts],
  );
  const targets = React.useMemo(
    () =>
      (onlyCards ? cardPaymentTargets : transferTargets)(
        accounts,
        draft.fromAccountId,
      ).map(({ value, label }) => ({ value, label })),
    [accounts, draft.fromAccountId, onlyCards],
  );
  const from = accounts.find((a) => a.id === draft.fromAccountId);
  const to = accounts.find((a) => a.id === draft.toAccountId);
  const cardPayment = isCardPayment(accounts, draft.toAccountId);
  const set = (patch: Partial<TransferDraft>) =>
    onChange({ ...draft, ...patch });
  const gql = useGql();

  // The sides already recorded (e.g. the bank brought the deposit), a
  // moment after the accounts, amount or date change.
  const args = legCandidatesArgs({
    fromAccountId: draft.fromAccountId ?? null,
    toAccountId: draft.toAccountId ?? null,
    amount: draft.amount,
    date: draft.date ?? null,
  });
  const argsKey = args ? JSON.stringify(args) : null;
  React.useEffect(() => {
    if (!argsKey) {
      onLegs(null);
      return;
    }
    let live = true;
    const timer = setTimeout(() => {
      gql<{ transferLegCandidates: TransferLegCandidates }>(
        TRANSFER_LEG_CANDIDATES_QUERY,
        JSON.parse(argsKey) as Record<string, unknown>,
      )
        .then((data) => live && onLegs(data.transferLegCandidates))
        .catch(() => live && onLegs(null));
    }, 400);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [argsKey, onLegs, gql]);

  return (
    <TwView className="gap-4">
      <AmountField
        value={draft.amount}
        onChange={(amount) => set({ amount })}
        currency={currencyOf(accounts, draft.fromAccountId)}
        error={errors.amount && t(`validation.${errors.amount}`)}
        autoFocus
      />
      <TwView className="gap-1">
        <Select
          label={t('fields.from')}
          options={sources}
          value={draft.fromAccountId ?? null}
          onValueChange={(fromAccountId) => {
            const stillValid = (
              onlyCards ? cardPaymentTargets : transferTargets
            )(accounts, fromAccountId).some(
              (o) => o.value === draft.toAccountId,
            );
            set({
              fromAccountId,
              toAccountId: stillValid ? draft.toAccountId : undefined,
            });
          }}
          placeholder={t('fields.fromPlaceholder')}
          searchPlaceholder={t('fields.accountSearch')}
          emptyLabel={t('fields.accountEmpty')}
          error={
            errors.fromAccountId && t(`validation.${errors.fromAccountId}`)
          }
          closeLabel={tc('close')}
        />
        {from ? (
          <Text className="px-1 text-xs text-on-surface-variant">
            {t('fields.available', {
              amount: formatMoney(from.balanceCurrent, from.currency, locale),
            })}
          </Text>
        ) : null}
      </TwView>
      <TwView className="gap-1">
        <Select
          label={t('fields.to')}
          options={targets}
          value={draft.toAccountId ?? null}
          onValueChange={(toAccountId) => set({ toAccountId })}
          placeholder={t('fields.toPlaceholder')}
          searchPlaceholder={t('fields.accountSearch')}
          emptyLabel={t('fields.toEmpty')}
          error={errors.toAccountId && t(`validation.${errors.toAccountId}`)}
          closeLabel={tc('close')}
        />
        {to && cardPayment ? (
          <Text className="px-1 text-xs text-on-surface-variant">
            {t('fields.owed', {
              amount: formatMoney(creditOwed(to), to.currency, locale),
            })}
          </Text>
        ) : null}
      </TwView>
      {cardPayment ? (
        <TwView className="flex-row items-start gap-2 rounded-xl bg-track p-3">
          <Icon icon={CreditCard} size={16} color="--violet-ink" />
          <Text className="flex-1 text-sm">{t('cardPaymentHint')}</Text>
        </TwView>
      ) : (
        <Text className="text-xs text-on-surface-variant">
          {t('transferHint')}
        </Text>
      )}
      <DatePicker
        label={t('fields.date')}
        locale={locale}
        value={draft.date}
        onChange={(date) => set({ date })}
        max={today}
        placeholder={t('fields.datePlaceholder')}
        error={errors.date && t(`validation.${errors.date}`)}
        closeLabel={tc('close')}
      />
      {cardPayment && cardDueDate && draft.date && draft.date > cardDueDate ? (
        <Text
          accessibilityLiveRegion="polite"
          className="text-xs text-on-surface-variant"
        >
          {t('cardPaymentLate', { date: shortDate(cardDueDate, locale) })}
        </Text>
      ) : null}
      <Input
        label={t('fields.transferDescription')}
        placeholder={t('fields.transferDescriptionPlaceholder')}
        value={draft.description}
        onChangeText={(description) => set({ description })}
        maxLength={120}
      />
      {legs && from && legs.from.length > 0 ? (
        <LegField
          account={accountLabel(from)}
          candidates={legs.from}
          picked={legPicks.from}
          onPick={(id) => onLegPick('from', id)}
        />
      ) : null}
      {legs && to && legs.to.length > 0 ? (
        <LegField
          account={accountLabel(to)}
          candidates={legs.to}
          picked={legPicks.to}
          onPick={(id) => onLegPick('to', id)}
        />
      ) : null}
      {submitError ? (
        <Text accessibilityRole="alert" className="text-sm text-expense">
          {submitError}
        </Text>
      ) : null}
      <Button
        label={
          busy
            ? busyLabel
            : cardPayment
              ? t('submit.cardPayment')
              : t('submit.transfer')
        }
        disabled={busy}
        onPress={onSubmit}
        className="w-full"
      />
    </TwView>
  );
}

/** "Ya existe en Mi Cuenta" (the web's LegField): use a recorded movement as that side. */
function LegField({
  account,
  candidates,
  picked,
  onPick,
}: {
  account: string;
  candidates: ApiTransaction[];
  picked: string | undefined;
  onPick: (id: string) => void;
}) {
  const t = useTranslations('newEntry.transferLegs');
  const l = useLocalizer();
  const chosen = legChoice(candidates, picked) ?? NEW_LEG;
  return (
    <TwView
      accessibilityRole="radiogroup"
      accessibilityLabel={t('existing', { account })}
      className="gap-2 rounded-xl border border-outline-variant p-3"
    >
      <Text weight="medium" className="text-sm">
        {t('existing', { account })}
      </Text>
      <Text className="text-xs text-on-surface-variant">{t('hint')}</Text>
      {candidates.map((candidate) => {
        const side = toMergeSide(candidate, l);
        return (
          <ChoiceRow
            key={candidate.id}
            selected={chosen === candidate.id}
            title={`${t('use')}: ${side.title}`}
            meta={[side.date, side.origin].join(' · ')}
            amount={side.amount}
            onPress={() => onPick(candidate.id)}
          />
        );
      })}
      <ChoiceRow
        selected={chosen === NEW_LEG}
        title={t('new')}
        onPress={() => onPick(NEW_LEG)}
      />
    </TwView>
  );
}
