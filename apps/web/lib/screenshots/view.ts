import {
  dayKeyOf,
  isDayKey,
  shortDate,
  startOfDayIso,
  type DayKey,
} from '@/lib/finance/dates';
import { formatMoney } from '@/lib/finance/money';
import type { Localizer } from '@/lib/i18n/translator';
import type { ScreenshotImport, ScreenshotLine } from './graphql';

export interface ScreenshotRow {
  id: string;
  merchant: string;
  /** "2 nov" */
  date: string;
  /** "-$299.00" / "+$2,500.00" */
  amount: string;
  direction: 'in' | 'out';
  inProcess: boolean;
  /** Will be saved. */
  included: boolean;
  /** Looks already registered: not saved unless the user says otherwise. */
  registered: { name: string; date: string; amount: string } | null;
  /** Something must be checked (unread or unsure field). */
  needsCheck: boolean;
  checkDate: boolean;
  checkMerchant: boolean;
  checkAmount: boolean;
  categoryId: string | null;
}

export interface ScreenshotReview {
  rows: ScreenshotRow[];
  /** Lines that will be saved. */
  toSave: number;
  /** Signed sum of those (money out negative). */
  total: string;
  alreadyRegistered: number;
  /** Included lines still to check (saving is allowed; they are highlighted). */
  toCheck: number;
  /** An included line has no amount yet: it can't be saved. */
  blocked: boolean;
}

export function buildScreenshotReview(
  shot: ScreenshotImport,
  { locale }: Pick<Localizer, 'locale'>,
): ScreenshotReview {
  const currency = shot.account?.currency ?? 'MXN';
  const money = (value: number, sign: 'always' | 'negative' = 'always') =>
    formatMoney(value, currency, locale, { sign });
  const rows = shot.lines.map((line): ScreenshotRow => {
    const signed = line.direction === 'out' ? -line.amount : line.amount;
    const review = new Set(line.review);
    const match = line.matchedTransaction;
    return {
      id: line.id,
      merchant: line.merchant ?? '',
      date: shortDate(dayKeyOf(line.date), locale),
      amount: line.amount > 0 ? money(signed) : '—',
      direction: line.direction,
      inProcess: line.inProcess,
      included: line.status === 'pending',
      registered:
        line.status === 'matched' && match
          ? {
              name: match.name ?? '',
              date: shortDate(dayKeyOf(match.date), locale),
              amount: money(match.amount, 'negative'),
            }
          : null,
      needsCheck: review.size > 0 || !(line.amount > 0),
      checkDate: review.has('date'),
      checkMerchant: review.has('merchant'),
      checkAmount: review.has('amount') || !(line.amount > 0),
      categoryId: line.categoryId,
    };
  });
  const included = shot.lines.filter((l) => l.status === 'pending');
  const sum = included.reduce(
    (acc, l) => acc + (l.direction === 'out' ? -l.amount : l.amount),
    0,
  );
  return {
    rows,
    toSave: included.length,
    total: money(Math.round(sum * 100) / 100),
    alreadyRegistered: shot.lines.filter((l) => l.status === 'matched').length,
    toCheck: rows.filter((r) => r.included && r.needsCheck).length,
    blocked: included.some((l) => !(l.amount > 0)),
  };
}

/** The editable values of a line, as the row editor starts. */
export interface LineDraft {
  merchant: string;
  date: DayKey;
  /** Raw money value ("299.00"). */
  amount: string;
  direction: 'in' | 'out';
  inProcess: boolean;
  categoryId: string;
}

export function lineDraftOf(line: ScreenshotLine): LineDraft {
  return {
    merchant: line.merchant ?? '',
    date: dayKeyOf(line.date),
    amount: line.amount > 0 ? line.amount.toFixed(2) : '',
    direction: line.direction,
    inProcess: line.inProcess,
    categoryId: line.categoryId ?? '',
  };
}

export type LineDraftError =
  | 'amountRequired'
  | 'dateInvalid'
  | 'merchantRequired';

export function validateLineDraft(
  draft: LineDraft,
  today: DayKey,
): Partial<Record<keyof LineDraft, LineDraftError>> {
  const errors: Partial<Record<keyof LineDraft, LineDraftError>> = {};
  const amount = Number(draft.amount);
  if (!draft.amount.trim() || !(amount > 0)) errors.amount = 'amountRequired';
  if (!isDayKey(draft.date) || draft.date > today) errors.date = 'dateInvalid';
  if (!draft.merchant.trim()) errors.merchant = 'merchantRequired';
  return errors;
}

/** Only what changed (UpdateScreenshotLineInput); null when nothing did. */
export function lineChangeOf(
  line: ScreenshotLine,
  draft: LineDraft,
): Record<string, unknown> | null {
  const start = lineDraftOf(line);
  const change: Record<string, unknown> = {};
  if (draft.merchant.trim() !== start.merchant)
    change.merchant = draft.merchant.trim();
  if (draft.date !== start.date) change.date = startOfDayIso(draft.date);
  const amount = Math.round(Number(draft.amount) * 100) / 100;
  if (amount !== line.amount) change.amount = amount;
  if (draft.direction !== start.direction) change.direction = draft.direction;
  if (draft.inProcess !== start.inProcess) change.inProcess = draft.inProcess;
  if (draft.categoryId !== start.categoryId)
    change.categoryId = draft.categoryId || null;
  // Saving a flagged line means the user checked it.
  if (Object.keys(change).length === 0 && line.review.length > 0) {
    if (line.review.includes('merchant'))
      change.merchant = draft.merchant.trim();
    if (line.review.includes('date')) change.date = startOfDayIso(draft.date);
    if (line.review.includes('amount')) change.amount = amount;
  }
  return Object.keys(change).length > 0 ? change : null;
}
