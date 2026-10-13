import { accountLabel } from '@/lib/finance/accounts';
import {
  dayKeyOf,
  longDate,
  shortDate,
  type DayKey,
} from '@/lib/finance/dates';
import { formatMoney } from '@/lib/finance/money';
import type { RecurringKind } from '@/lib/finance/types';
import type { Localizer } from '@/lib/i18n/translator';
import type { ApiRecurringSuggestion } from './types';
import { frequencyLabel } from './view';

/** A detected recurring payment as its card shows it. */
export interface SuggestionCard {
  fingerprint: string;
  name: string;
  merchant: string;
  kind: RecurringKind;
  categoryLabel: string | null;
  frequencyLabel: string;
  amountLabel: string;
  isVariableAmount: boolean;
  accountLabel: string | null;
  nextDueLabel: string;
  /** The movements it was detected from, newest first. */
  evidence: { key: string; dateLabel: string; amountLabel: string }[];
  /** 0–100 */
  confidence: number;
  classifiedByAi: boolean;
}

export function toSuggestionCard(
  suggestion: ApiRecurringSuggestion,
  today: DayKey,
  { locale, t }: Localizer,
): SuggestionCard {
  const money = (n: number) => formatMoney(n, suggestion.currency, locale);
  const evidence = [...suggestion.occurrences]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((o) => ({
      key: o.transactionId,
      dateLabel: longDate(dayKeyOf(o.date), today, locale),
      amountLabel: money(o.amount),
    }));
  return {
    fingerprint: suggestion.fingerprint,
    name: suggestion.suggestedName,
    merchant: suggestion.merchant,
    kind: suggestion.kind,
    categoryLabel: suggestion.category?.name ?? null,
    frequencyLabel: frequencyLabel(
      suggestion.frequency,
      suggestion.interval,
      t,
    ),
    amountLabel: money(suggestion.amount),
    isVariableAmount: suggestion.isVariableAmount,
    accountLabel: suggestion.account ? accountLabel(suggestion.account) : null,
    nextDueLabel: shortDate(dayKeyOf(suggestion.nextDueDate), locale),
    evidence,
    confidence: confidencePercent(suggestion.confidence),
    classifiedByAi: suggestion.classifiedBy === 'ai',
  };
}

/** The API's confidence (0–1; a 0–100 value is accepted too) as a percent. */
export function confidencePercent(value: number): number {
  const ratio = value > 1 ? value / 100 : value;
  return Math.round(Math.min(1, Math.max(0, ratio || 0)) * 100);
}
