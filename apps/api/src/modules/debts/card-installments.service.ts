import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  AccountType,
  DebtStatus,
  LoanType,
  OccurrenceMatchSource,
  OccurrenceStatus,
  Prisma,
  TransactionType,
} from '@finnit/database';
import { PrismaService } from '../../services/prisma.service';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../common/exceptions/graphql-error.exception';
import { localToday } from '../../common/utils/local-date.util';
import { RecurringExpensesService } from '../recurring-expenses/recurring-expenses.service';
import { CardTerms, DayKey, dayKey } from '../credit-cards/credit-card-cycle';
import { Debt } from './dto/debt.dto';
import {
  CardInstallmentLinkOptions,
  CardInstallmentLinkPlan,
} from './dto/card-installment-link.dto';
import { DebtsService } from './debts.service';
import { syncDebtStatus } from './debt-ledger';
import { namesMatch } from './loan-links';
import {
  fitsInstallment,
  fitsPurchase,
  planInstallments,
} from './card-installments';

type Client = Prisma.TransactionClient | PrismaService;

const PLAN_SELECT = {
  id: true,
  name: true,
  description: true,
  principal: true,
  startDate: true,
  installmentsTotal: true,
  installmentAmount: true,
  totalToRepay: true,
  purchaseTransactionId: true,
  linkedAccount: {
    select: {
      creditCardTerms: { select: { statementDay: true, paymentDueDay: true } },
    },
  },
  recurringExpense: {
    select: {
      id: true,
      merchantPattern: true,
      categoryId: true,
      occurrences: {
        where: { status: { not: OccurrenceStatus.skipped } },
        orderBy: { dueDate: 'asc' as const },
        select: {
          id: true,
          dueDate: true,
          originalDueDate: true,
          expectedAmount: true,
          status: true,
          transactionId: true,
        },
      },
    },
  },
} satisfies Prisma.DebtSelect;

type PlanRow = Prisma.DebtGetPayload<{ select: typeof PLAN_SELECT }>;

const textOf = (t: {
  merchantName: string | null;
  description: string | null;
}) => t.merchantName || t.description || '';

/**
 * Purchases on a credit card paid in installments, from the movements'
 * side: an expense on the card is the whole purchase (its charge) or one
 * monthly installment. A purchase whose charge is on the card is in the
 * card's balance: its installments are billed by the card at each cut-off
 * (paid without a movement), so they never count as spending twice.
 */
@Injectable()
export class CardInstallmentsService {
  private readonly logger = new Logger(CardInstallmentsService.name);

  /** Every morning: the installments the cards billed overnight. */
  @Cron('30 5 * * *', {
    name: 'card-installments-billing',
    timeZone: 'America/Mexico_City',
  })
  async runDaily(): Promise<void> {
    try {
      await this.billInstallments(this.prisma, null, localToday());
    } catch (error) {
      this.logger.error('Card installments billing failed', error as Error);
    }
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly debts: DebtsService,
    private readonly recurring: RecurringExpensesService,
  ) {}

  async linkOptions(
    userId: string,
    transactionId: string,
  ): Promise<CardInstallmentLinkOptions> {
    const movement = await this.prisma.transaction.findFirst({
      where: { id: transactionId, userId },
      include: {
        account: { select: { id: true, type: true } },
        debtPurchase: {
          select: { id: true, name: true, installmentsTotal: true },
        },
        recurringPayment: {
          select: {
            id: true,
            dueDate: true,
            originalDueDate: true,
            recurringExpense: { select: { debtId: true } },
          },
        },
      },
    });
    if (!movement) throw new NotFoundError('Transaction not found');
    if (
      movement.type !== TransactionType.expense ||
      movement.account.type !== AccountType.credit
    ) {
      throw new ValidationError(
        'Only an expense on a credit card can be part of a purchase in installments',
      );
    }

    const plans = await this.plansOf(this.prisma, userId, movement.accountId);
    const day = dayKey(movement.txnDate);
    const amount = Number(movement.amount);
    const text = textOf(movement);
    const today = dayKey(localToday());

    let linked: CardInstallmentLinkOptions['linked'];
    if (movement.debtPurchase) {
      linked = {
        debtId: movement.debtPurchase.id,
        name: movement.debtPurchase.name,
        purchase: true,
        installmentsTotal: movement.debtPurchase.installmentsTotal ?? 0,
      };
    } else if (movement.recurringPayment?.recurringExpense.debtId) {
      const plan = plans.find(
        (p) => p.id === movement.recurringPayment!.recurringExpense.debtId,
      );
      if (plan) {
        linked = {
          debtId: plan.id,
          name: plan.name,
          purchase: false,
          occurrenceId: movement.recurringPayment.id,
          number: numberOf(plan, movement.recurringPayment),
          installmentsTotal: plan.installmentsTotal ?? 0,
        };
      }
    }

    const options: (CardInstallmentLinkPlan & { score: number })[] = plans.map(
      (plan) => {
        const purchaseDay = dayKey(plan.startDate!);
        const occurrences = plan.recurringExpense?.occurrences ?? [];
        const withMovement = occurrences.some((o) => o.transactionId);
        const purchaseLinked = Boolean(plan.purchaseTransactionId);
        const purchaseFits = fitsPurchase(
          { amount, day },
          { principal: Number(plan.principal), purchaseDay },
        );
        const nameMatches = namesMatch(
          text,
          [plan.recurringExpense?.merchantPattern, plan.name, plan.description],
          new Set(),
        );
        const installments = purchaseLinked
          ? []
          : occurrences
              .filter(
                (o) =>
                  !o.transactionId &&
                  (o.status !== OccurrenceStatus.paid ||
                    o.transactionId === null),
              )
              .map((o) => {
                const due = dayKey(o.dueDate);
                const expected = Number(o.expectedAmount);
                return {
                  occurrenceId: o.id,
                  number: numberOf(plan, o),
                  dueDate: o.dueDate,
                  amount: expected,
                  fits: fitsInstallment(
                    { amount, day },
                    { amount: expected, day: due },
                  ),
                  state:
                    o.status === OccurrenceStatus.paid
                      ? 'paid_without_movement'
                      : o.status === OccurrenceStatus.missed || due < today
                        ? 'overdue'
                        : 'open',
                };
              });
        const canLinkPurchase = !purchaseLinked && !withMovement;
        const score =
          (nameMatches ? 4 : 0) +
          (canLinkPurchase && purchaseFits ? 3 : 0) +
          (installments.some((i) => i.fits) ? 2 : 0);
        return {
          debtId: plan.id,
          name: plan.name,
          principal: Number(plan.principal),
          installmentsTotal: plan.installmentsTotal ?? 0,
          installmentAmount: Number(plan.installmentAmount ?? 0),
          purchaseDate: plan.startDate!,
          purchaseLinked,
          canLinkPurchase,
          purchaseFits,
          nameMatches,
          installments,
          score,
        };
      },
    );
    options.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

    // Suggest only what fits: the purchase, else the closest installment.
    let suggestedDebtId: string | undefined;
    let suggestedOccurrenceId: string | undefined;
    if (!linked) {
      const best = options.find(
        (o) =>
          (o.canLinkPurchase && o.purchaseFits) ||
          o.installments.some((i) => i.fits),
      );
      if (best) {
        suggestedDebtId = best.debtId;
        if (!(best.canLinkPurchase && best.purchaseFits)) {
          suggestedOccurrenceId = closest(best.installments, day)?.occurrenceId;
        }
      }
    }
    return {
      accountId: movement.accountId,
      linked,
      suggestedDebtId,
      suggestedOccurrenceId,
      plans: options.map((plan) => {
        const { score, ...rest } = plan;
        void score;
        return rest;
      }),
    };
  }

  /** The movement is the card's charge of the whole purchase. */
  async linkPurchase(
    userId: string,
    debtId: string,
    transactionId: string,
  ): Promise<Debt> {
    const plan = await this.prisma.debt.findFirst({
      where: { id: debtId, userId, loanType: LoanType.card_installments },
      select: PLAN_SELECT_WITH_ACCOUNT,
    });
    if (!plan) throw new NotFoundError('Purchase in installments not found');
    if (plan.purchaseTransactionId) {
      throw new ConflictError(
        'This purchase already has its charge; unlink it first',
      );
    }
    if (plan.recurringExpense?.occurrences.some((o) => o.transactionId)) {
      throw new ConflictError(
        'Its installments are already linked to movements: the purchase is not on the card as a whole',
      );
    }
    const movement = await this.prisma.transaction.findFirst({
      where: { id: transactionId, userId },
      include: {
        debtPurchase: { select: { id: true } },
        debtPayment: { select: { id: true } },
        recurringPayment: { select: { id: true } },
      },
    });
    if (!movement) throw new NotFoundError('Transaction not found');
    if (
      movement.type !== TransactionType.expense ||
      movement.accountId !== plan.linkedAccountId
    ) {
      throw new ValidationError(
        'The purchase must be an expense on the same card',
      );
    }
    if (
      movement.debtPurchase ||
      movement.debtPayment ||
      movement.recurringPayment
    ) {
      throw new ConflictError('This movement already pays something else');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.debt.update({
        where: { id: debtId },
        data: { purchaseTransactionId: movement.id },
      });
      await this.billInstallments(tx, debtId, localToday());
    });
    return this.debts.findById(debtId, userId);
  }

  /** The purchase no longer has its charge; billed installments stay paid. */
  async unlinkPurchase(userId: string, debtId: string): Promise<Debt> {
    const plan = await this.prisma.debt.findFirst({
      where: { id: debtId, userId, loanType: LoanType.card_installments },
      select: { id: true, purchaseTransactionId: true },
    });
    if (!plan) throw new NotFoundError('Purchase in installments not found');
    if (!plan.purchaseTransactionId) {
      throw new ValidationError('This purchase has no charge linked');
    }
    await this.prisma.debt.update({
      where: { id: debtId },
      data: { purchaseTransactionId: null },
    });
    return this.debts.findById(debtId, userId);
  }

  /**
   * The installments a card already billed of purchases whose charge is on
   * the card: paid without a movement (the purchase was the spending) up to
   * `today`. Every such plan when no id is given (the daily job).
   */
  async billInstallments(
    client: Client,
    debtId: string | null,
    today: Date,
  ): Promise<number> {
    const plans = await client.debt.findMany({
      where: {
        ...(debtId ? { id: debtId } : {}),
        loanType: LoanType.card_installments,
        purchaseTransactionId: { not: null },
        status: DebtStatus.active,
      },
      select: {
        id: true,
        recurringExpense: {
          select: {
            occurrences: {
              where: {
                dueDate: { lte: today },
                transactionId: null,
                status: {
                  in: [OccurrenceStatus.upcoming, OccurrenceStatus.missed],
                },
              },
              select: { id: true, dueDate: true, expectedAmount: true },
            },
          },
        },
      },
    });
    let billed = 0;
    const run = async (tx: Prisma.TransactionClient) => {
      for (const plan of plans) {
        for (const o of plan.recurringExpense?.occurrences ?? []) {
          const paid = await this.recurring.markPaidInTransaction(
            tx,
            o.id,
            null,
            OccurrenceMatchSource.manual,
          );
          if (!paid) continue;
          // Billed by the card: the purchase already counted as spending.
          await tx.debtPayment.create({
            data: {
              debtId: plan.id,
              isHistorical: true,
              amount: o.expectedAmount,
              date: o.dueDate,
            },
          });
          billed += 1;
        }
        await syncDebtStatus(tx, plan.id);
      }
    };
    if ('$transaction' in client) {
      await client.$transaction(run);
    } else {
      await run(client);
    }
    if (billed > 0) {
      this.logger.log(`Billed ${billed} card installments`);
    }
    return billed;
  }

  /**
   * After a bank sync: an expense that is clearly the whole purchase of a
   * plan on that card (its amount, within days of the purchase, naming it,
   * the only candidate) becomes its charge.
   */
  async linkSyncedPurchases(
    userId: string,
    transactionIds: string[],
  ): Promise<number> {
    if (transactionIds.length === 0) return 0;
    const created = await this.prisma.transaction.findMany({
      where: {
        id: { in: transactionIds },
        userId,
        type: TransactionType.expense,
        account: { type: AccountType.credit },
        debtPurchase: { is: null },
        debtPayment: { is: null },
        recurringPayment: { is: null },
      },
    });
    let linked = 0;
    for (const accountId of new Set(created.map((m) => m.accountId))) {
      linked += await this.linkPurchasesOn(
        userId,
        accountId,
        created.filter((m) => m.accountId === accountId),
      );
    }
    return linked;
  }

  private async linkPurchasesOn(
    userId: string,
    accountId: string,
    movements: {
      id: string;
      amount: Prisma.Decimal;
      txnDate: Date;
      merchantName: string | null;
      description: string | null;
    }[],
  ): Promise<number> {
    const plans = (await this.plansOf(this.prisma, userId, accountId)).filter(
      (p) =>
        !p.purchaseTransactionId &&
        !p.recurringExpense?.occurrences.some((o) => o.transactionId),
    );
    if (plans.length === 0) return 0;
    let linked = 0;
    const taken = new Set<string>();
    for (const plan of plans) {
      const purchaseDay = dayKey(plan.startDate!);
      const candidates = movements.filter(
        (m) =>
          !taken.has(m.id) &&
          fitsPurchase(
            { amount: Number(m.amount), day: dayKey(m.txnDate) },
            { principal: Number(plan.principal), purchaseDay },
          ) &&
          namesMatch(
            textOf(m),
            [
              plan.recurringExpense?.merchantPattern,
              plan.name,
              plan.description,
            ],
            new Set(),
          ),
      );
      if (candidates.length !== 1) continue;
      taken.add(candidates[0].id);
      await this.linkPurchase(userId, plan.id, candidates[0].id);
      linked += 1;
    }
    return linked;
  }

  /** The user's purchases in installments on a card, still owing. */
  private plansOf(
    client: Client,
    userId: string,
    accountId: string,
  ): Promise<PlanRow[]> {
    return client.debt.findMany({
      where: {
        userId,
        linkedAccountId: accountId,
        loanType: LoanType.card_installments,
        startDate: { not: null },
        installmentsTotal: { not: null },
      },
      select: PLAN_SELECT,
      orderBy: { startDate: 'desc' },
    });
  }
}

const PLAN_SELECT_WITH_ACCOUNT = {
  ...PLAN_SELECT,
  linkedAccountId: true,
} satisfies Prisma.DebtSelect;

/** Which installment an occurrence is, from where it falls in the plan. */
function numberOf(
  plan: PlanRow,
  occurrence: { dueDate: Date; originalDueDate: Date | null },
): number {
  const terms: CardTerms | null = plan.linkedAccount?.creditCardTerms ?? null;
  const schedule = planInstallments(
    {
      debtId: plan.id,
      name: plan.name,
      purchaseDay: dayKey(plan.startDate!),
      count: plan.installmentsTotal ?? 0,
      totalToRepay: Number(plan.totalToRepay ?? plan.principal),
      installmentAmount: Number(plan.installmentAmount ?? 0),
      purchaseChargedOn: null,
    },
    terms,
  );
  const day = dayKey(occurrence.originalDueDate ?? occurrence.dueDate);
  const exact = schedule.find((i) => i.day === day);
  if (exact) return exact.number;
  // Moved or generated by another rhythm: the closest one.
  const closestItem = closest(
    schedule.map((i) => ({ ...i, dueDate: new Date(`${i.day}T00:00:00Z`) })),
    day,
  );
  return closestItem?.number ?? 1;
}

function closest<T extends { dueDate: Date }>(
  items: T[],
  day: DayKey,
): T | undefined {
  const time = Date.parse(`${day}T00:00:00Z`);
  let best: T | undefined;
  for (const item of items) {
    if (
      !best ||
      Math.abs(item.dueDate.getTime() - time) <
        Math.abs(best.dueDate.getTime() - time)
    ) {
      best = item;
    }
  }
  return best;
}
