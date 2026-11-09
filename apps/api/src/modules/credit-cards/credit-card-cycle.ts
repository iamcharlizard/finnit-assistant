/**
 * A credit card's billing cycles (periodos de corte a corte), as pure rules.
 *
 * A cycle runs from the day after the previous cut-off to its cut-off
 * (`statementDay`, clamped to the month's length). Its payment is due on the
 * next `paymentDueDay` after the cut-off. What was owed at the cut-off is
 * today's balance minus every movement after it, so payments made before the
 * cut-off (advance payments) are already in it. What counts towards a cycle
 * are the credits (payments, refunds) between its cut-off and its due date.
 *
 * Days are `YYYY-MM-DD` strings (the account's local days).
 */

export type DayKey = string;

/** The `YYYY-MM-DD` of a date-only value (midnight UTC). */
export const dayKey = (date: Date): DayKey => date.toISOString().slice(0, 10);

export interface CardTerms {
  statementDay: number;
  paymentDueDay: number;
}

export interface CycleDates {
  /** First day of the cycle (the day after the previous cut-off). */
  periodStart: DayKey;
  /** Cut-off: last day of the cycle. */
  statementDate: DayKey;
  /** Last day to pay what was owed at the cut-off without interest. */
  paymentDueDate: DayKey;
}

export type CycleStatus = 'open' | 'due' | 'paid' | 'unpaid';

/** A movement of the card, as the figures need it. */
export interface CycleMovement {
  day: DayKey;
  /** Signed effect on the card's balance (a charge is negative). */
  effect: number;
  /** Credits that are not payments (the bank difference adjustment). */
  notPayment?: boolean;
}

/** Statement data that replaces what is computed for that cut-off. */
export interface StatementFigures {
  statementDate: DayKey;
  paymentDueDate: DayKey | null;
  periodStart: DayKey | null;
  statementBalance: number | null;
  noInterestPayment: number | null;
  minimumPayment: number | null;
}

export interface CycleFigures extends CycleDates {
  /** Owed at the cut-off (0 when the card was in favor). */
  balanceAtStatement: number;
  /** Card installment plans (MSI) of the cycle not recorded on the card yet. */
  pendingInstallments: number;
  /**
   * Installments after the cut-off of purchases already in the balance:
   * owed, but not due this cycle.
   */
  deferredInstallments: number;
  /** Installments billed in this cycle (all plans). */
  installmentsInCycle: number;
  /** Installments still to bill after the cut-off (all plans). */
  installmentBalance: number;
  /** The part of the no-interest payment that is not installments. */
  cashBalance: number;
  /** "Pago para no generar intereses". */
  noInterestPayment: number;
  minimumPayment: number | null;
  /** Credits between the cut-off and the due date. */
  paid: number;
  /** What is left of the no-interest payment. */
  remaining: number;
  status: CycleStatus;
  /** The amounts come from an imported statement. */
  fromStatement: boolean;
}

const cents = (n: number) => Math.round(n * 100) / 100;

const pad = (n: number) => String(n).padStart(2, '0');

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** `day` of a month, clamped to its length (31 → 30, 28 or 29). */
export function dayOfMonth(year: number, month: number, day: number): DayKey {
  // Months may come out of range (13, 0): normalize first.
  const date = new Date(Date.UTC(year, month - 1, 1));
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  return `${y}-${pad(m)}-${pad(Math.min(day, daysInMonth(y, m)))}`;
}

export function addDays(day: DayKey, days: number): DayKey {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to`. */
export function daysBetween(from: DayKey, to: DayKey): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  );
}

const parts = (day: DayKey) => {
  const [y, m] = day.split('-').map(Number);
  return { year: y, month: m };
};

/** The cut-off of the cycle that contains `day`. */
export function statementOn(day: DayKey, terms: CardTerms): DayKey {
  const { year, month } = parts(day);
  const cut = dayOfMonth(year, month, terms.statementDay);
  return day <= cut ? cut : dayOfMonth(year, month + 1, terms.statementDay);
}

/** The cut-off before `statementDate`. */
export function previousStatement(
  statementDate: DayKey,
  terms: CardTerms,
): DayKey {
  const { year, month } = parts(statementDate);
  return dayOfMonth(year, month - 1, terms.statementDay);
}

/** The first `paymentDueDay` after the cut-off. */
export function dueDateAfter(statementDate: DayKey, terms: CardTerms): DayKey {
  const { year, month } = parts(statementDate);
  const same = dayOfMonth(year, month, terms.paymentDueDay);
  return same > statementDate
    ? same
    : dayOfMonth(year, month + 1, terms.paymentDueDay);
}

export function cycleOf(statementDate: DayKey, terms: CardTerms): CycleDates {
  return {
    periodStart: addDays(previousStatement(statementDate, terms), 1),
    statementDate,
    paymentDueDate: dueDateAfter(statementDate, terms),
  };
}

/**
 * The cycles to show, newest first: the open one (today's), then the closed
 * ones before it. `before` starts the list at the cycle before that cut-off.
 */
export function cyclesBefore(
  today: DayKey,
  terms: CardTerms,
  count: number,
  before?: DayKey,
): CycleDates[] {
  let cut = before
    ? previousStatement(statementOn(before, terms), terms)
    : statementOn(today, terms);
  const cycles: CycleDates[] = [];
  for (let i = 0; i < count; i++) {
    cycles.push(cycleOf(cut, terms));
    cut = previousStatement(cut, terms);
  }
  return cycles;
}

/**
 * The closed cycle whose payment is due next (or was due last, while today
 * is still before the next cut-off): the one the user is paying now.
 */
export function payingCycle(today: DayKey, terms: CardTerms): CycleDates {
  return cycleOf(previousStatement(statementOn(today, terms), terms), terms);
}

/** Balance of the card at the end of `day`: today's minus what came after. */
export function balanceAt(
  day: DayKey,
  currentBalance: number,
  movements: ReadonlyArray<CycleMovement>,
): number {
  const after = movements
    .filter((m) => m.day > day)
    .reduce((sum, m) => sum + m.effect, 0);
  return cents(currentBalance - after);
}

/** Credits (payments, refunds) in `(from, to]`. */
export function creditsIn(
  from: DayKey,
  to: DayKey,
  movements: ReadonlyArray<CycleMovement>,
): number {
  return cents(
    movements
      .filter(
        (m) => m.day > from && m.day <= to && m.effect > 0 && !m.notPayment,
      )
      .reduce((sum, m) => sum + m.effect, 0),
  );
}

/** A cycle's numbers on `today`. */
export function cycleFigures(
  dates: CycleDates,
  {
    today,
    currentBalance,
    movements,
    pendingInstallments = 0,
    deferredInstallments = 0,
    installmentsInCycle = 0,
    installmentBalance = 0,
    statement,
  }: {
    today: DayKey;
    currentBalance: number;
    movements: ReadonlyArray<CycleMovement>;
    pendingInstallments?: number;
    deferredInstallments?: number;
    installmentsInCycle?: number;
    installmentBalance?: number;
    statement?: StatementFigures | null;
  },
): CycleFigures {
  const fromStatement = Boolean(statement);
  const cycle: CycleDates = {
    periodStart: statement?.periodStart ?? dates.periodStart,
    statementDate: dates.statementDate,
    paymentDueDate: statement?.paymentDueDate ?? dates.paymentDueDate,
  };
  const computedOwed = Math.max(
    0,
    -balanceAt(cycle.statementDate, currentBalance, movements),
  );
  const balanceAtStatement = cents(statement?.statementBalance ?? computedOwed);
  // The balance has whole purchases in installments: only this cycle's
  // installment is due; plans billed month by month add theirs when the
  // card has no movement for it yet.
  const noInterestPayment = cents(
    statement?.noInterestPayment ??
      Math.max(0, computedOwed + pendingInstallments - deferredInstallments),
  );
  const paid = creditsIn(cycle.statementDate, cycle.paymentDueDate, movements);
  const remaining = cents(Math.max(0, noInterestPayment - paid));

  const status: CycleStatus =
    today <= cycle.statementDate
      ? 'open'
      : remaining <= 0
        ? 'paid'
        : today > cycle.paymentDueDate
          ? 'unpaid'
          : 'due';

  return {
    ...cycle,
    balanceAtStatement,
    pendingInstallments: cents(pendingInstallments),
    deferredInstallments: cents(deferredInstallments),
    installmentsInCycle: cents(installmentsInCycle),
    installmentBalance: cents(installmentBalance),
    cashBalance: cents(Math.max(0, noInterestPayment - installmentsInCycle)),
    noInterestPayment,
    minimumPayment: statement?.minimumPayment ?? null,
    paid,
    remaining,
    status,
    fromStatement,
  };
}

/** VAT on interest in Mexico. */
export const INTEREST_VAT = 0.16;

/**
 * An estimate of the interest for what was left unpaid at the due date,
 * charged until the next cut-off: unpaid × (annual rate / 360) × days, plus
 * VAT. The statement's real figure (average daily balance) may differ, so
 * it is only a starting point the user corrects.
 */
export function interestEstimate(
  unpaid: number,
  annualRatePercent: number | null,
  from: DayKey,
  to: DayKey,
): number | null {
  if (!annualRatePercent || annualRatePercent <= 0 || unpaid <= 0) return null;
  const days = Math.max(0, daysBetween(from, to));
  return cents(
    unpaid * (annualRatePercent / 100 / 360) * days * (1 + INTEREST_VAT),
  );
}

/** The reminders a cycle has on `today`. */
export type ReminderKind = 'statement' | 'due_soon' | 'due_today' | 'unpaid';

export const DUE_SOON_DAYS = 3;

export function remindersOn(
  today: DayKey,
  figures: CycleFigures,
): ReminderKind[] {
  const kinds: ReminderKind[] = [];
  // The day after the cut-off: the cycle just closed (its movements are in).
  if (
    today === addDays(figures.statementDate, 1) &&
    figures.noInterestPayment > 0
  ) {
    kinds.push('statement');
  }
  if (figures.remaining > 0) {
    const days = daysBetween(today, figures.paymentDueDate);
    if (days === DUE_SOON_DAYS) kinds.push('due_soon');
    if (days === 0) kinds.push('due_today');
    if (days === -1) kinds.push('unpaid');
  }
  return kinds;
}
