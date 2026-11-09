import { OccurrenceStatus, Prisma } from '@finnit/database';
import {
  addDays,
  dayKey,
  dayOfMonth,
  statementOn,
  type CardTerms,
} from '../credit-cards/credit-card-cycle';
import { toDateOnly } from '../recurring-expenses/schedule.util';
import type { ScheduleEntry } from './card-installments';

/**
 * A card purchase in installments keeps every installment as an occurrence
 * of its recurring expense, from the first to the last (not only the next
 * ~60 days like other recurring payments): each one has its own day and
 * amount, which the user may change. The expense's rule never generates
 * them (see `RecurringExpensesService.syncOccurrences`).
 */

type Client = Prisma.TransactionClient;

const cents = (n: number) => Math.round(n * 100) / 100;
const dateOf = (day: string) => new Date(`${day}T00:00:00.000Z`);

/**
 * Writes the open installments of a new plan from its schedule: the ones
 * already paid (its history) stay, every other one is (re)created on its
 * day with its amount.
 */
export async function materializeCardSchedule(
  tx: Client,
  debtId: string,
  schedule: readonly ScheduleEntry[],
): Promise<void> {
  const expense = await tx.recurringExpense.findUnique({
    where: { debtId },
    include: { occurrences: true },
  });
  if (!expense || schedule.length === 0) return;
  const paidDays = new Set(
    expense.occurrences
      .filter((o) => o.status === OccurrenceStatus.paid)
      .map((o) => dayKey(o.dueDate)),
  );
  await tx.recurringOccurrence.deleteMany({
    where: {
      recurringExpenseId: expense.id,
      status: { not: OccurrenceStatus.paid },
      transactionId: null,
    },
  });
  const open = schedule.filter((s) => !paidDays.has(s.day));
  if (open.length > 0) {
    await tx.recurringOccurrence.createMany({
      data: open.map((s) => ({
        recurringExpenseId: expense.id,
        dueDate: dateOf(s.day),
        expectedAmount: s.amount,
      })),
      skipDuplicates: true,
    });
  }
  await refreshCardPlan(tx, debtId);
}

/**
 * Plans created before every installment was stored have only the next
 * few: the missing ones are added after the last, one per cut-off (or a
 * month apart without the card's terms), the last taking what is left.
 */
export async function ensureCardSchedule(
  tx: Client,
  debtId: string,
): Promise<number> {
  const debt = await tx.debt.findUnique({
    where: { id: debtId },
    select: {
      installmentsTotal: true,
      installmentAmount: true,
      totalToRepay: true,
      principal: true,
      linkedAccount: {
        select: {
          creditCardTerms: {
            select: { statementDay: true, paymentDueDay: true },
          },
        },
      },
      recurringExpense: {
        include: {
          occurrences: {
            where: { status: { not: OccurrenceStatus.skipped } },
            orderBy: { dueDate: 'asc' },
          },
        },
      },
    },
  });
  const expense = debt?.recurringExpense;
  if (!debt || !expense || !debt.installmentsTotal) return 0;
  const existing = expense.occurrences;
  const missing = debt.installmentsTotal - existing.length;
  if (missing <= 0 || existing.length === 0) return 0;

  const terms: CardTerms | null = debt.linkedAccount?.creditCardTerms ?? null;
  const each = Number(debt.installmentAmount ?? 0);
  const total = Number(debt.totalToRepay ?? debt.principal);
  const stored = existing.reduce((s, o) => s + Number(o.expectedAmount), 0);
  const last = existing[existing.length - 1].dueDate;
  const anchor = last.getUTCDate();
  const days: string[] = [];
  let day = dayKey(last);
  for (let i = 0; i < missing; i++) {
    const [y, m] = day.split('-').map(Number);
    day = terms
      ? statementOn(addDays(day, 1), terms)
      : dayOfMonth(y, m + 1, anchor);
    days.push(day);
  }
  await tx.recurringOccurrence.createMany({
    data: days.map((d, i) => ({
      recurringExpenseId: expense.id,
      dueDate: dateOf(d),
      expectedAmount:
        i === missing - 1
          ? Math.max(0.01, cents(total - stored - each * (missing - 1)))
          : each,
    })),
    skipDuplicates: true,
  });
  await refreshCardPlan(tx, debtId);
  return missing;
}

/**
 * After its installments changed: the debt owes their sum and ends on the
 * last one; the expense asks for the next open one.
 */
export async function refreshCardPlan(tx: Client, debtId: string) {
  const expense = await tx.recurringExpense.findUnique({
    where: { debtId },
    include: {
      occurrences: {
        where: { status: { not: OccurrenceStatus.skipped } },
        orderBy: { dueDate: 'asc' },
      },
    },
  });
  if (!expense || expense.occurrences.length === 0) return;
  const occurrences = expense.occurrences;
  const total = cents(
    occurrences.reduce((s, o) => s + Number(o.expectedAmount), 0),
  );
  const last = occurrences[occurrences.length - 1].dueDate;
  const today = toDateOnly(new Date());
  const next = occurrences.find(
    (o) => o.status === OccurrenceStatus.upcoming && o.dueDate >= today,
  );
  await tx.debt.update({
    where: { id: debtId },
    data: { totalToRepay: total, dueDate: last },
  });
  await tx.recurringExpense.update({
    where: { id: expense.id },
    data: {
      endDate: last,
      nextDueDate: next?.dueDate ?? null,
      ...(next && { amount: next.expectedAmount }),
    },
  });
}
