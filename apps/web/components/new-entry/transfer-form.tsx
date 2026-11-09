'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CreditCard } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { Combobox } from '@finnit/ui/components/ui/combobox';
import { DatePicker } from '@finnit/ui/components/ui/date-picker';
import { Input } from '@finnit/ui/components/ui/input';

import { creditOwed } from '@finnit/core/finance/accounts';
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
  transferTargets,
} from '@finnit/core/new-entry/options';
import { CandidateOption } from '@/components/transfers/convert-transfer-dialog';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import { accountLabel } from '@finnit/core/finance/accounts';
import {
  NEW_LEG,
  TRANSFER_LEG_CANDIDATES_QUERY,
  legCandidatesArgs,
  legChoice,
  type TransferLegCandidates,
} from '@finnit/core/transfers/legs';
import { toMergeSide } from '@finnit/core/duplicates/view';
import type { ApiTransaction } from '@finnit/core/finance/types';
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
}: {
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
  const locale = useLocale();
  const today = todayKey();

  const sources = React.useMemo(() => transferSources(accounts), [accounts]);
  const targets = React.useMemo(
    () => transferTargets(accounts, draft.fromAccountId),
    [accounts, draft.fromAccountId],
  );
  const from = accounts.find((a) => a.id === draft.fromAccountId);
  const to = accounts.find((a) => a.id === draft.toAccountId);
  const cardPayment = isCardPayment(accounts, draft.toAccountId);
  const money = (amount: number, currency: string) =>
    formatMoney(amount, currency, locale);

  const set = (patch: Partial<TransferDraft>) =>
    onChange({ ...draft, ...patch });

  // Look for the sides already recorded (e.g. the bank brought the
  // deposit) a moment after the accounts, amount or date change.
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
    const timer = window.setTimeout(() => {
      gql<{ transferLegCandidates: TransferLegCandidates }>(
        TRANSFER_LEG_CANDIDATES_QUERY,
        JSON.parse(argsKey) as Record<string, unknown>,
      )
        .then((data) => live && onLegs(data.transferLegCandidates))
        .catch(() => live && onLegs(null));
    }, 400);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [argsKey, onLegs]);

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="flex flex-col gap-4"
    >
      <AmountField
        value={draft.amount}
        onChange={(amount) => set({ amount })}
        currency={currencyOf(accounts, draft.fromAccountId)}
        error={errors.amount && t(`validation.${errors.amount}`)}
        autoFocus
      />
      <div className="flex flex-col gap-1">
        <Combobox
          label={t('fields.from')}
          options={sources}
          value={draft.fromAccountId}
          onChange={(fromAccountId) => {
            const stillValid = transferTargets(accounts, fromAccountId).some(
              (o) => o.value === draft.toAccountId,
            );
            set({
              fromAccountId,
              toAccountId: stillValid ? draft.toAccountId : undefined,
            });
          }}
          placeholder={t('fields.fromPlaceholder')}
          searchPlaceholder={t('fields.accountSearch')}
          emptyText={t('fields.accountEmpty')}
          error={
            errors.fromAccountId && t(`validation.${errors.fromAccountId}`)
          }
        />
        {from ? (
          <p className="text-xs text-on-surface-variant">
            {t('fields.available', {
              amount: money(from.balanceCurrent, from.currency),
            })}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1">
        <Combobox
          label={t('fields.to')}
          options={targets}
          value={draft.toAccountId}
          onChange={(toAccountId) => set({ toAccountId })}
          placeholder={t('fields.toPlaceholder')}
          searchPlaceholder={t('fields.accountSearch')}
          emptyText={t('fields.toEmpty')}
          error={errors.toAccountId && t(`validation.${errors.toAccountId}`)}
        />
        {to && cardPayment ? (
          <p className="text-xs text-on-surface-variant">
            {t('fields.owed', { amount: money(creditOwed(to), to.currency) })}
          </p>
        ) : null}
      </div>
      {cardPayment ? (
        <p className="flex items-start gap-2 rounded-xl bg-track p-3 text-sm text-on-background">
          <CreditCard
            aria-hidden
            className="mt-0.5 size-4 shrink-0 text-violet-ink"
          />
          {t('cardPaymentHint')}
        </p>
      ) : (
        <p className="text-xs text-on-surface-variant">{t('transferHint')}</p>
      )}
      <DatePicker
        label={t('fields.date')}
        value={draft.date}
        onChange={(date) => set({ date })}
        max={today}
        locale={locale}
        placeholder={t('fields.datePlaceholder')}
        required
        error={errors.date && t(`validation.${errors.date}`)}
      />
      {cardPayment && cardDueDate && draft.date && draft.date > cardDueDate ? (
        <p role="status" className="text-xs text-on-surface-variant">
          {t('cardPaymentLate', { date: shortDate(cardDueDate, locale) })}
        </p>
      ) : null}
      <Input
        label={t('fields.transferDescription')}
        placeholder={t('fields.transferDescriptionPlaceholder')}
        value={draft.description}
        onChange={(e) => set({ description: e.target.value })}
        maxLength={120}
        autoComplete="off"
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
        <p role="alert" className="text-sm text-expense">
          {submitError}
        </p>
      ) : null}
      <Button type="submit" disabled={busy} className="w-full">
        {busy
          ? busyLabel
          : cardPayment
            ? t('submit.cardPayment')
            : t('submit.transfer')}
      </Button>
    </form>
  );
}

/**
 * "Ya existe en Mi Cuenta": movements of that side already recorded with
 * this amount. Using one makes it that side instead of creating a copy;
 * the only match comes chosen.
 */
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
    <div
      role="radiogroup"
      aria-label={t('existing', { account })}
      className="flex flex-col gap-2 rounded-xl border border-outline-variant p-3"
    >
      <p className="text-sm font-medium text-on-background">
        {t('existing', { account })}
      </p>
      <p className="text-xs text-on-surface-variant">{t('hint')}</p>
      {candidates.map((candidate) => {
        const side = toMergeSide(candidate, l);
        return (
          <CandidateOption
            key={candidate.id}
            selected={chosen === candidate.id}
            title={`${t('use')}: ${side.title}`}
            meta={[side.amount, side.date, side.origin].join(' · ')}
            onSelect={() => onPick(candidate.id)}
          />
        );
      })}
      <CandidateOption
        selected={chosen === NEW_LEG}
        title={t('new')}
        meta=""
        onSelect={() => onPick(NEW_LEG)}
      />
    </div>
  );
}
