import { createHash } from 'node:crypto';
import {
  RecurringExpenseKind,
  RecurringFrequency,
  TransactionSource,
} from '@finnit/database';
import { normalizeText } from '../../statements/parsing/parse-utils';
import { identifiesRecurring } from '../../statements/reconciliation/matching';
import { addDays, nextDueDate, toDateOnly } from '../schedule.util';

/**
 * Detection of recurring payments in the user's expenses (feature 15). Pure:
 * no database, no AI. The service feeds it transactions and the user's
 * existing recurring expenses and decorates the result.
 */

const DAY_MS = 86_400_000;
/** Transactions older than this are not looked at. */
export const SUGGESTION_LOOKBACK_DAYS = 396; // ~13 months
/** Share of the intervals that must fit the cadence. */
const MIN_FIT_RATIO = 0.7;
/** An occurrence further than this from the median makes the amount variable. */
const FIXED_TOLERANCE = 0.15;
/** An occurrence further than this from the median rules the group out. */
const VARIABLE_TOLERANCE = 0.5;
/** The latest charge must be at most this many cadences old. */
const MAX_STALENESS = 1.5;

export interface SuggestionTransaction {
  id: string;
  date: Date;
  amount: number;
  currency: string;
  accountId: string;
  categoryId: string | null;
  merchantName: string | null;
  description: string | null;
  source: TransactionSource;
}

export interface KnownRecurringExpense {
  name: string;
  merchantPattern: string | null;
}

export interface SuggestionOccurrence {
  transactionId: string;
  date: Date;
  amount: number;
  source: TransactionSource;
}

export interface DetectedSuggestion {
  fingerprint: string;
  /** Normalized merchant as printed (e.g. "APPLE COM BILL"). */
  merchant: string;
  currency: string;
  frequency: RecurringFrequency;
  interval: number;
  /** Median of the occurrences. */
  amount: number;
  isVariableAmount: boolean;
  /** Rules-based kind (the AI may replace it). */
  kind: RecurringExpenseKind;
  accountId: string | null;
  categoryId: string | null;
  nextDueDate: Date;
  /** Newest first. */
  occurrences: SuggestionOccurrence[];
  confidence: number;
}

interface Cadence {
  frequency: RecurringFrequency;
  /** Typical days between charges. */
  days: number;
  /** An interval (and the median) fits when within days ± tolerance. */
  tolerance: number;
  minOccurrences: number;
  /** Fewer charges are enough when the amount is fixed (±15%). */
  minFixedOccurrences: number;
}

const CADENCES: Cadence[] = [
  {
    frequency: RecurringFrequency.weekly,
    days: 7,
    tolerance: 2,
    minOccurrences: 3,
    minFixedOccurrences: 3,
  },
  {
    frequency: RecurringFrequency.biweekly,
    days: 14,
    tolerance: 2,
    minOccurrences: 3,
    minFixedOccurrences: 3,
  },
  {
    frequency: RecurringFrequency.semimonthly,
    days: 15,
    tolerance: 3,
    minOccurrences: 3,
    minFixedOccurrences: 3,
  },
  // 30 ± 5 covers the 28–33 days between same-day charges of consecutive months.
  {
    frequency: RecurringFrequency.monthly,
    days: 30,
    tolerance: 5,
    minOccurrences: 3,
    minFixedOccurrences: 2,
  },
  {
    frequency: RecurringFrequency.bimonthly,
    days: 61,
    tolerance: 7,
    minOccurrences: 3,
    minFixedOccurrences: 2,
  },
  {
    frequency: RecurringFrequency.quarterly,
    days: 91,
    tolerance: 10,
    minOccurrences: 3,
    minFixedOccurrences: 2,
  },
  {
    frequency: RecurringFrequency.semiannual,
    days: 182,
    tolerance: 15,
    minOccurrences: 2,
    minFixedOccurrences: 2,
  },
  {
    frequency: RecurringFrequency.yearly,
    days: 365,
    tolerance: 20,
    minOccurrences: 2,
    minFixedOccurrences: 2,
  },
];

/** Approximate days between due dates of a frequency (interval 1). */
export const FREQUENCY_DAYS: Record<RecurringFrequency, number> =
  Object.fromEntries(CADENCES.map((c) => [c.frequency, c.days])) as Record<
    RecurringFrequency,
    number
  >;

// "(007:012)", "007 DE 012", "3/12" in parentheses, "MSI", "A MESES", "MESES SIN INTERESES".
const INSTALLMENT_MARKERS = [
  /\(\s*\d{1,3}\s*[:/]\s*\d{1,3}\s*\)/,
  /\b\d{1,3}\s+DE\s+\d{1,3}\b/,
  /\bMSI\b/,
  /\bA\s*MESES/,
  /MESES\s+SIN\s+INTERESES/,
];

/**
 * Mexican RFC (tax id) printed after the merchant: 3–4 letters, 6 digits
 * (date) and a 3-character homoclave, often followed by "MX". Banks sometimes
 * glue it to the previous word ("ONLYFANSFPA 231020BF8MX"), so 3 letters
 * without a leading space are taken too.
 */
const RFC = /(?:\s[A-Z&]{3,4}|[A-Z&]{3})\s?\d{6}[A-Z0-9]{3}(?:MX)?(?=\s|$)/g;

function upperAscii(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
}

/** Installment purchases ("meses sin intereses") are handled by statements. */
export function isInstallmentText(value: string): boolean {
  const text = upperAscii(value);
  return INSTALLMENT_MARKERS.some((marker) => marker.test(text));
}

/**
 * Merchant as a stable, readable string: uppercase, no accents, no RFC,
 * reference numbers, installment markers or punctuation.
 * "KSK*VID ONLYFANS FPA 231020BF8MX" → "KSK VID ONLYFANS".
 */
export function normalizeMerchant(value: string): string {
  return upperAscii(value)
    .replace(INSTALLMENT_MARKERS[0], ' ')
    .replace(RFC, ' ')
    .replace(/[^A-Z0-9& ]+/g, ' ')
    .split(/\s+/)
    .filter((word) => word && !/\d/.test(word) && word !== '&')
    .join(' ');
}

/** Grouping key: banks drop spaces at random ("APPLE.COM/BILLCUPERTINOCA"). */
export function merchantKey(merchant: string): string {
  return merchant.replace(/\s+/g, '');
}

export function suggestionFingerprint(
  userId: string,
  key: string,
  currency: string,
  amountBucket?: number,
): string {
  const parts = [userId, key, currency.toUpperCase()];
  if (amountBucket !== undefined) parts.push(`~${amountBucket}`);
  return createHash('sha1').update(parts.join('|')).digest('hex');
}

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

function mostCommon<T>(values: T[]): T | null {
  const counts = new Map<T, number>();
  let best: T | null = null;
  let bestCount = 0;
  for (const value of values) {
    const count = (counts.get(value) ?? 0) + 1;
    counts.set(value, count);
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

/** Cadences that bill on a day of the month (monthly or longer). */
const MONTH_DAY_CADENCES = new Set<RecurringFrequency>([
  RecurringFrequency.monthly,
  RecurringFrequency.bimonthly,
  RecurringFrequency.quarterly,
  RecurringFrequency.semiannual,
  RecurringFrequency.yearly,
]);

/**
 * Every charge falls on the same day of the month, give or take a day. Days
 * past the 28th count as the 28th, so month ends (Jan 31, Feb 28) match.
 */
export function onSameMonthDay(dates: Date[]): boolean {
  const days = dates.map((date) => Math.min(date.getUTCDate(), 28));
  return Math.max(...days) - Math.min(...days) <= 1;
}

/** The 15th and the month's last day (± 3 days, or the 1st–2nd). */
function looksSemimonthly(dates: Date[]): boolean {
  const near = dates.filter((date) => {
    const day = date.getUTCDate();
    const last = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
    ).getUTCDate();
    return Math.abs(day - 15) <= 3 || day >= last - 3 || day <= 2;
  });
  return near.length / dates.length >= MIN_FIT_RATIO;
}

function cadenceFor(intervals: number[], dates: Date[]): Cadence | undefined {
  const typical = median(intervals);
  const fits = CADENCES.filter(
    (c) => Math.abs(typical - c.days) <= c.tolerance,
  );
  if (fits.length === 0) return undefined;
  // 12–16 days fits both every-14-days and the 15th/month-end schedule.
  const semimonthly = fits.find(
    (c) => c.frequency === RecurringFrequency.semimonthly,
  );
  if (semimonthly && looksSemimonthly(dates)) return semimonthly;
  return (
    fits
      .filter((c) => c !== semimonthly)
      .sort(
        (a, b) => Math.abs(typical - a.days) - Math.abs(typical - b.days),
      )[0] ?? semimonthly
  );
}

interface Group {
  key: string;
  currency: string;
  merchants: string[];
  transactions: SuggestionTransaction[];
}

interface Analysis {
  cadence: Cadence;
  amount: number;
  isVariableAmount: boolean;
  /** Largest relative distance of an amount from the median. */
  maxDeviation: number;
  fitRatio: number;
  last: Date;
}

type AnalysisResult =
  | { ok: true; analysis: Analysis }
  | { ok: false; reason: 'cadence' | 'amount' };

function analyze(
  transactions: SuggestionTransaction[],
  today: Date,
  maxTolerance: number,
): AnalysisResult {
  // Two charges on the same day count once for the cadence.
  const dates = [
    ...new Set(transactions.map((t) => toDateOnly(t.date).getTime())),
  ]
    .sort((a, b) => a - b)
    .map((time) => new Date(time));
  if (dates.length < 2) return { ok: false, reason: 'cadence' };

  const intervals = dates
    .slice(1)
    .map((date, i) =>
      Math.round((date.getTime() - dates[i].getTime()) / DAY_MS),
    );
  const cadence = cadenceFor(intervals, dates);
  // Two charges on the same day of the month (± 1) are enough for a monthly
  // or longer cadence, even if the amount varies.
  const sameMonthDay =
    !!cadence &&
    MONTH_DAY_CADENCES.has(cadence.frequency) &&
    onSameMonthDay(dates);
  if (
    !cadence ||
    dates.length < (sameMonthDay ? 2 : cadence.minFixedOccurrences)
  ) {
    return { ok: false, reason: 'cadence' };
  }
  const fitting = intervals.filter(
    (days) => Math.abs(days - cadence.days) <= cadence.tolerance,
  ).length;
  const fitRatio = fitting / intervals.length;
  if (fitRatio < MIN_FIT_RATIO) return { ok: false, reason: 'cadence' };

  const last = dates[dates.length - 1];
  const age = (toDateOnly(today).getTime() - last.getTime()) / DAY_MS;
  if (age > cadence.days * MAX_STALENESS) {
    return { ok: false, reason: 'cadence' };
  }

  const amounts = transactions.map((t) => t.amount);
  const amount = median(amounts);
  const maxDeviation = Math.max(
    ...amounts.map((value) => Math.abs(value - amount) / amount),
  );
  if (maxDeviation > maxTolerance) return { ok: false, reason: 'amount' };
  // E.g. a monthly charge seen only twice counts only at a fixed price.
  const isVariableAmount = maxDeviation > FIXED_TOLERANCE;
  if (
    isVariableAmount &&
    !sameMonthDay &&
    dates.length < cadence.minOccurrences
  ) {
    return { ok: false, reason: 'amount' };
  }

  return {
    ok: true,
    analysis: {
      cadence,
      amount: round2(amount),
      isVariableAmount,
      maxDeviation,
      fitRatio,
      last,
    },
  };
}

/**
 * Splits a merchant's charges into price points (several subscriptions billed
 * by the same merchant, e.g. Apple): amounts within 15% of the cluster's
 * smallest one go together.
 */
function amountClusters(
  transactions: SuggestionTransaction[],
): SuggestionTransaction[][] {
  const sorted = [...transactions].sort((a, b) => a.amount - b.amount);
  const clusters: SuggestionTransaction[][] = [];
  for (const transaction of sorted) {
    const current = clusters[clusters.length - 1];
    if (
      current &&
      transaction.amount <= current[0].amount * (1 + FIXED_TOLERANCE)
    ) {
      current.push(transaction);
    } else {
      clusters.push([transaction]);
    }
  }
  return clusters;
}

/** Stable-ish bucket of a price, for the fingerprint of a price point. */
function amountBucket(amount: number): number {
  return Math.round(Math.log(Math.max(amount, 0.01)) / Math.log(1.2));
}

function confidence(analysis: Analysis, count: number): number {
  const countScore = Math.min(1, (count - 1) / 5);
  const amountScore = Math.max(0, 1 - analysis.maxDeviation);
  const value =
    0.45 * analysis.fitRatio + 0.35 * countScore + 0.2 * amountScore;
  return Math.round(Math.min(1, Math.max(0, value)) * 100) / 100;
}

function rulesKind(analysis: Analysis): RecurringExpenseKind {
  return analysis.cadence.days <= 30 && !analysis.isVariableAmount
    ? RecurringExpenseKind.subscription
    : RecurringExpenseKind.other;
}

function build(
  group: Group,
  transactions: SuggestionTransaction[],
  analysis: Analysis,
  fingerprint: string,
  today: Date,
): DetectedSuggestion {
  const newestFirst = [...transactions].sort(
    (a, b) => b.date.getTime() - a.date.getTime(),
  );
  // The next charge from today on: a charge due yesterday that hasn't shown
  // up yet is late, not the next one to plan for.
  const after = addDays(analysis.last, 1);
  const from = toDateOnly(today) > after ? toDateOnly(today) : after;
  const next =
    nextDueDate(
      {
        frequency: analysis.cadence.frequency,
        interval: 1,
        startDate: analysis.last,
      },
      from,
    ) ?? addDays(analysis.last, analysis.cadence.days);
  return {
    fingerprint,
    merchant: mostCommon(group.merchants) ?? group.key,
    currency: group.currency,
    frequency: analysis.cadence.frequency,
    interval: 1,
    amount: analysis.amount,
    isVariableAmount: analysis.isVariableAmount,
    kind: rulesKind(analysis),
    accountId: mostCommon(transactions.map((t) => t.accountId)),
    categoryId: mostCommon(
      transactions.map((t) => t.categoryId).filter((id): id is string => !!id),
    ),
    nextDueDate: next,
    occurrences: newestFirst.map((t) => ({
      transactionId: t.id,
      date: toDateOnly(t.date),
      amount: t.amount,
      source: t.source,
    })),
    confidence: confidence(analysis, transactions.length),
  };
}

export interface DetectOptions {
  userId: string;
  today: Date;
  /** The user's recurring expenses (active or not): their merchants are skipped. */
  existing: KnownRecurringExpense[];
}

/**
 * Groups expenses by normalized merchant + currency and returns the groups
 * charged on a regular cadence, most confident first. Expects the caller to
 * pass only non-pending expenses not yet linked to a recurring payment.
 */
export function detectRecurring(
  transactions: SuggestionTransaction[],
  { userId, today, existing }: DetectOptions,
): DetectedSuggestion[] {
  const since = addDays(toDateOnly(today), -SUGGESTION_LOOKBACK_DAYS);
  const groups = new Map<string, Group>();

  for (const transaction of transactions) {
    if (!(transaction.amount > 0) || transaction.date < since) continue;
    const raw = `${transaction.merchantName ?? ''} ${transaction.description ?? ''}`;
    if (isInstallmentText(raw)) continue;
    const merchant = normalizeMerchant(
      transaction.merchantName?.trim() || transaction.description || '',
    );
    const key = merchantKey(merchant);
    if (key.length < 3) continue;
    const currency = transaction.currency.toUpperCase();
    const id = `${key}|${currency}`;
    const group = groups.get(id) ?? {
      key,
      currency,
      merchants: [],
      transactions: [],
    };
    group.merchants.push(merchant);
    group.transactions.push(transaction);
    groups.set(id, group);
  }

  const known = existing.map((expense) => ({
    merchantPattern: expense.merchantPattern,
    expenseName: expense.name,
  }));
  const tracked = (group: Group) =>
    group.transactions.some((t) => {
      const text = normalizeText(
        `${t.merchantName ?? ''} ${t.description ?? ''}`,
      );
      return known.some((expense) => identifiesRecurring(text, expense));
    });

  const suggestions: DetectedSuggestion[] = [];
  for (const group of groups.values()) {
    if (group.transactions.length < 2 || tracked(group)) continue;

    const whole = analyze(group.transactions, today, VARIABLE_TOLERANCE);
    if (whole.ok) {
      suggestions.push(
        build(
          group,
          group.transactions,
          whole.analysis,
          suggestionFingerprint(userId, group.key, group.currency),
          today,
        ),
      );
      continue;
    }
    // Several price points (e.g. two Apple subscriptions) or a regular one
    // hidden among one-off purchases at the same merchant.
    for (const cluster of amountClusters(group.transactions)) {
      if (cluster.length < 2) continue;
      const result = analyze(cluster, today, FIXED_TOLERANCE);
      if (!result.ok) continue;
      suggestions.push(
        build(
          group,
          cluster,
          result.analysis,
          suggestionFingerprint(
            userId,
            group.key,
            group.currency,
            amountBucket(result.analysis.amount),
          ),
          today,
        ),
      );
    }
  }

  return suggestions.sort(
    (a, b) =>
      b.confidence - a.confidence || a.merchant.localeCompare(b.merchant),
  );
}
