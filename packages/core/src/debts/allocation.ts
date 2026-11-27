/**
 * How a loan payment splits over its pending scheduled payments, the same
 * way the API does it (`allocatePayment` in loan-math.ts): the ones chosen
 * first (by date), then, when asked, the next ones; the rest only lowers
 * the balance (abono). Used to preview the split before saving.
 */
import { roundCents } from '../finance/money';
import type { ScheduleRow } from './detail-view';

/** Where what is left after the chosen payments goes. */
export type PaymentSurplus = 'next' | 'balance';

/** A pending scheduled payment that a payment can cover. */
export interface PendingPayment {
  occurrenceId: string;
  dueDate: string;
  dateLabel: string;
  /** Still due on it (less what split payments already paid). */
  due: number;
  dueLabel: string;
  /** "Pantalla 01/03", …: what it pays. */
  concepts: string[];
}

export interface AllocationPreview {
  allocations: { occurrenceId: string; amount: number; settles: boolean }[];
  /** Due on the chosen payments beyond the amount. */
  shortfall: number;
  /** Beyond the chosen payments (before giving it to the next ones). */
  surplus: number;
  /** Not given to any scheduled payment (with `balance`, or none left). */
  toBalance: number;
  /** The chosen payment that stays paid in part, when it falls short. */
  partial: PendingPayment | null;
}

/** The schedule's open payments that can still get money, by date. */
export function pendingPayments(
  rows: ReadonlyArray<ScheduleRow>,
): PendingPayment[] {
  return rows
    .filter((r) => r.occurrenceId && r.dueAmount > 0)
    .map((r) => ({
      occurrenceId: r.occurrenceId!,
      dueDate: r.dueDate,
      dateLabel: r.dateLabel,
      due: r.dueAmount,
      dueLabel: r.partialLabel ?? r.amountLabel,
      concepts: r.concepts,
    }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

const cents = (n: number) => Math.round(n * 100);

export function previewAllocation(
  amount: number,
  pending: ReadonlyArray<PendingPayment>,
  chosenIds: ReadonlyArray<string>,
  surplus: PaymentSurplus,
): AllocationPreview {
  const chosen = pending.filter((p) => chosenIds.includes(p.occurrenceId));
  const next = pending.filter((p) => !chosenIds.includes(p.occurrenceId));
  let left = cents(Math.max(0, amount));
  const allocations: AllocationPreview['allocations'] = [];
  let partial: PendingPayment | null = null;
  const give = (rows: PendingPayment[], track: boolean) => {
    for (const row of rows) {
      const due = cents(row.due);
      if (left <= 0 || due <= 0) continue;
      const part = Math.min(left, due);
      allocations.push({
        occurrenceId: row.occurrenceId,
        amount: part / 100,
        settles: part >= due,
      });
      if (track && part < due) partial = row;
      left -= part;
    }
  };
  give(chosen, true);
  const owed = chosen.reduce((sum, r) => sum + cents(r.due), 0);
  const given = allocations.reduce((sum, a) => sum + cents(a.amount), 0);
  const beyond = left;
  // Chosen ones left without any money also stay due.
  if (!partial && owed > given) {
    partial =
      chosen.find(
        (r) => !allocations.some((a) => a.occurrenceId === r.occurrenceId),
      ) ?? null;
  }
  if (surplus === 'next') give(next, false);
  return {
    allocations,
    shortfall: roundCents(Math.max(0, owed - given) / 100),
    surplus: beyond / 100,
    toBalance: left / 100,
    partial,
  };
}
