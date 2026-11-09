/**
 * A purchase on a credit card paid in monthly installments (meses con o
 * sin intereses), as pure rules. Each installment is billed on a cut-off of
 * the card: the first on the cut-off of the cycle the purchase falls in,
 * then one per cut-off. Without the card's terms, a month after the
 * purchase and then monthly on that day.
 *
 * Days are `YYYY-MM-DD` strings.
 */
import {
  CardTerms,
  DayKey,
  addDays,
  dayOfMonth,
  statementOn,
} from '../credit-cards/credit-card-cycle';

const parts = (day: DayKey) => {
  const [year, month, date] = day.split('-').map(Number);
  return { year, month, date };
};

/** The cut-off that bills the first installment (or a month later). */
export function firstInstallmentDay(
  purchase: DayKey,
  terms: CardTerms | null,
): DayKey {
  if (terms) return statementOn(purchase, terms);
  const { year, month, date } = parts(purchase);
  return dayOfMonth(year, month + 1, date);
}

/** The days `count` installments are billed, oldest first. */
export function installmentDays(
  purchase: DayKey,
  count: number,
  terms: CardTerms | null,
): DayKey[] {
  const days: DayKey[] = [];
  let day = firstInstallmentDay(purchase, terms);
  const anchor = terms ? terms.statementDay : parts(purchase).date;
  for (let i = 0; i < count; i++) {
    days.push(day);
    const { year, month } = parts(day);
    day = terms
      ? statementOn(addDays(day, 1), terms)
      : dayOfMonth(year, month + 1, anchor);
  }
  return days;
}

/** Installments already billed on `today` (their cut-off came). */
export function billedInstallments(
  purchase: DayKey,
  count: number,
  terms: CardTerms | null,
  today: DayKey,
): number {
  return installmentDays(purchase, count, terms).filter((d) => d <= today)
    .length;
}

const cents = (n: number) => Math.round(n * 100) / 100;

/** A card purchase in installments, as the card's cycles need it. */
export interface InstallmentPlan {
  debtId: string;
  name: string;
  purchaseDay: DayKey;
  count: number;
  totalToRepay: number;
  installmentAmount: number;
  /**
   * Day of the card's charge of the whole purchase, when recorded: from
   * then on the card's balance has the whole purchase in it.
   */
  purchaseChargedOn: DayKey | null;
  /** Its stored installments (edited days or amounts), oldest first. */
  schedule?: ScheduleEntry[];
}

export interface ScheduledInstallment {
  day: DayKey;
  number: number;
  amount: number;
}

/** Every installment of a plan: equal ones, the last takes the rest. */
export function planInstallments(
  plan: InstallmentPlan,
  terms: CardTerms | null,
): ScheduledInstallment[] {
  if (plan.schedule && plan.schedule.length > 0) {
    return plan.schedule.map((s, i) => ({ ...s, number: i + 1 }));
  }
  const each = plan.installmentAmount;
  const last = cents(plan.totalToRepay - each * (plan.count - 1));
  return installmentDays(plan.purchaseDay, plan.count, terms).map((day, i) => ({
    day,
    number: i + 1,
    amount: i === plan.count - 1 ? last : each,
  }));
}

export interface CycleInstallments {
  /** Billed in the cycle, all plans. */
  inCycle: number;
  /** After the cut-off, all plans. */
  balance: number;
  /** After the cut-off, of plans whose whole purchase is in the balance. */
  deferred: number;
  /** Plans whose whole purchase is in the balance at the cut-off. */
  inBalance: Set<string>;
  rows: {
    debtId: string;
    name: string;
    number: number;
    total: number;
    amount: number;
    left: number;
  }[];
}

/** What the plans bill in the cycle `(periodStart − 1, statementDate]`. */
export function cycleInstallments(
  plans: ReadonlyArray<InstallmentPlan>,
  terms: CardTerms | null,
  cycle: { periodStart: DayKey; statementDate: DayKey },
): CycleInstallments {
  const out: CycleInstallments = {
    inCycle: 0,
    balance: 0,
    deferred: 0,
    inBalance: new Set(),
    rows: [],
  };
  for (const plan of plans) {
    const schedule = planInstallments(plan, terms);
    const future = schedule.filter((i) => i.day > cycle.statementDate);
    const futureSum = future.reduce((sum, i) => sum + i.amount, 0);
    out.balance += futureSum;
    if (
      plan.purchaseChargedOn !== null &&
      plan.purchaseChargedOn <= cycle.statementDate
    ) {
      out.inBalance.add(plan.debtId);
      out.deferred += futureSum;
    }
    for (const item of schedule) {
      if (item.day < cycle.periodStart || item.day > cycle.statementDate) {
        continue;
      }
      out.inCycle += item.amount;
      out.rows.push({
        debtId: plan.debtId,
        name: plan.name,
        number: item.number,
        total: schedule.length,
        amount: item.amount,
        left: cents(futureSum),
      });
    }
  }
  out.inCycle = cents(out.inCycle);
  out.balance = cents(out.balance);
  out.deferred = cents(out.deferred);
  return out;
}

/** The purchase's charge: its whole amount (±1 %) within 5 days. */
export const PURCHASE_AMOUNT_TOLERANCE = 0.01;
export const PURCHASE_DAYS = 5;
/** A monthly installment's charge: ±10 % within 10 days of its cut-off. */
export const INSTALLMENT_AMOUNT_TOLERANCE = 0.1;
export const INSTALLMENT_DAYS = 10;

const DAY_MS = 86_400_000;
const daysApart = (a: DayKey, b: DayKey) =>
  Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) /
  DAY_MS;

const near = (amount: number, expected: number, share: number) =>
  Math.abs(amount - expected) <= Math.max(1, expected * share);

/** Whether a charge of `amount` on `day` looks like the whole purchase. */
export function fitsPurchase(
  charge: { amount: number; day: DayKey },
  plan: { principal: number; purchaseDay: DayKey },
): boolean {
  return (
    near(charge.amount, plan.principal, PURCHASE_AMOUNT_TOLERANCE) &&
    daysApart(charge.day, plan.purchaseDay) <= PURCHASE_DAYS
  );
}

/** Whether a charge looks like the installment billed on `target.day`. */
export function fitsInstallment(
  charge: { amount: number; day: DayKey },
  target: { amount: number; day: DayKey },
): boolean {
  return (
    near(charge.amount, target.amount, INSTALLMENT_AMOUNT_TOLERANCE) &&
    daysApart(charge.day, target.day) <= INSTALLMENT_DAYS
  );
}

/** One installment as stored: the day it is billed and its amount. */
export interface ScheduleEntry {
  day: DayKey;
  amount: number;
}

/**
 * The installments a plan starts with: on the card's cut-offs, equal ones
 * with the last taking the cents left (total − each × (n − 1)).
 */
export function defaultSchedule(
  purchase: DayKey,
  count: number,
  terms: CardTerms | null,
  totalToRepay: number,
  installmentAmount: number,
): ScheduleEntry[] {
  const last = cents(totalToRepay - installmentAmount * (count - 1));
  return installmentDays(purchase, count, terms).map((day, i) => ({
    day,
    amount: i === count - 1 ? last : installmentAmount,
  }));
}

/**
 * Moves installment `index` to `day`; with `following`, the ones after it
 * go to that same day of the next months (clamped to short months).
 */
export function moveInstallment(
  days: readonly DayKey[],
  index: number,
  day: DayKey,
  following: boolean,
): DayKey[] {
  const next = [...days];
  next[index] = day;
  if (!following) return next;
  const { year, month, date } = parts(day);
  for (let j = index + 1; j < next.length; j++) {
    next[j] = dayOfMonth(year, month + (j - index), date);
  }
  return next;
}

/** Why a schedule can't be saved, or null: days ascending, amounts > 0. */
export function scheduleError(
  schedule: readonly ScheduleEntry[],
  purchase: DayKey,
): 'dates' | 'amounts' | null {
  if (schedule.some((s) => !(s.amount > 0))) return 'amounts';
  for (let i = 0; i < schedule.length; i++) {
    if (schedule[i].day < purchase) return 'dates';
    if (i > 0 && schedule[i].day <= schedule[i - 1].day) return 'dates';
  }
  return null;
}
