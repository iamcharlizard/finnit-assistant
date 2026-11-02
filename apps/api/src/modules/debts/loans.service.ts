import { Injectable } from '@nestjs/common';
import {
  DebtChargeDestination,
  DebtKind,
  LoanInterestMode,
  LoanType,
  OccurrenceMatchSource,
  OccurrenceStatus,
  Prisma,
  RecurringExpenseKind,
  RecurringFrequency,
  RecurringTrackingMode,
  TransactionType,
  AccountType,
} from '@finnit/database';
import { PrismaService } from '../../services/prisma.service';
import {
  ConflictError,
  DebtOverpaymentError,
  NotFoundError,
  ValidationError,
} from '../../common/exceptions/graphql-error.exception';
import {
  PaidHistoryItem,
  RecurringExpensesService,
} from '../recurring-expenses/recurring-expenses.service';
import {
  RecurringSuggestionsService,
  guessLoanType,
  titleCase,
} from '../recurring-expenses/suggestions/recurring-suggestions.service';
import { FREQUENCY_DAYS } from '../recurring-expenses/suggestions/detect';
import {
  addDays,
  dueDatesAfter,
  monthlyEquivalent,
  ScheduleRule,
  toDateOnly,
} from '../recurring-expenses/schedule.util';
import { TransactionsService } from '../transactions/transactions.service';
import { ContactsService } from '../contacts/contacts.service';
import {
  debtPaymentCategoryKey,
  defaultCategoryId,
} from '../auth/default-categories';
import {
  AcceptSuggestionAsLoanInput,
  AddDebtChargeInput,
  CreateDebtInput,
  Debt,
  MAX_ANNUAL_RATE,
  RecordDebtPaymentInput,
  UpdateLoanInput,
} from './dto/debt.dto';
import { DEBT_INCLUDE, DebtsService } from './debts.service';
import {
  balanceOf,
  createMovement,
  defaultPurchaseDate,
  deleteDeposit,
  syncDebtStatus,
  totalOwedOf,
} from './debt-ledger';
import { LoanTermsError, resolveLoanTerms } from './loan-math';

type Tx = Prisma.TransactionClient;

/** Payments must add up to at most the amount owed (one cent of slack). */
const CENT = 0.01;

const cents = (amount: number) => Math.round(amount * 100) / 100;

/** A loan's repayment once its terms are known. */
interface ResolvedTerms {
  totalToRepay: number;
  installmentAmount: number | null;
}

/** What `create` gets from an accepted recurring suggestion. */
interface FromSuggestion {
  /** Detected charges: they become paid installments with their movements. */
  history: PaidHistoryItem[];
  afterCreate: (tx: Tx) => Promise<void>;
  /** The suggestion's category, when the user has no Loan Payments one. */
  categoryId?: string;
}

/**
 * Loans (debts of kind loan with a loan type): terms, payment schedule (a
 * recurring expense linked to the debt), payments made before registering
 * them, charges that add to them, and payments made from an account.
 */
@Injectable()
export class LoansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly debts: DebtsService,
    private readonly recurring: RecurringExpensesService,
    private readonly suggestions: RecurringSuggestionsService,
    private readonly transactions: TransactionsService,
    private readonly contacts: ContactsService,
  ) {}

  async create(
    userId: string,
    input: CreateDebtInput,
    fromSuggestion?: FromSuggestion,
  ): Promise<Debt> {
    const loanType = input.loanType;
    const name = input.name?.trim();
    if (!loanType) throw new ValidationError('The loan type is required');
    if (input.kind !== DebtKind.loan) {
      throw new ValidationError('Only loans have a loan type');
    }
    if (!name) throw new ValidationError('The name cannot be empty');
    this.assertPrincipal(input.principal, loanType);
    this.assertRate(input.interestRateAnnual);

    const fixedTerm = loanType !== LoanType.personal;
    const frequency = input.paymentFrequency;
    const firstPaymentDate = input.firstPaymentDate
      ? toDateOnly(new Date(input.firstPaymentDate))
      : undefined;
    if (fixedTerm) {
      if (!frequency || !firstPaymentDate) {
        throw new ValidationError(
          'The payment frequency and first payment date are required',
        );
      }
      if (!input.installmentsTotal || !input.interestMode) {
        throw new ValidationError(
          'The number of payments and how the interest is given are required',
        );
      }
    }

    const periodicFee = input.periodicFee ? cents(input.periodicFee) : 0;
    if (
      periodicFee > 0 &&
      (loanType !== LoanType.institutional ||
        input.interestMode !== LoanInterestMode.rate)
    ) {
      throw new ValidationError(
        'Only bank or lender loans given by their rate have a fee per payment',
      );
    }

    const terms = this.resolveTerms({
      principal: input.principal,
      installments: input.installmentsTotal,
      frequency: frequency ?? RecurringFrequency.monthly,
      interestMode: input.interestMode,
      interestRateAnnual: input.interestRateAnnual,
      includesVat: input.includesVat,
      totalToRepay: input.totalToRepay,
      installmentAmount: input.installmentAmount,
      periodicFee,
    });

    const isPurchase = loanType === LoanType.purchase_financing;
    const startDate = input.startDate
      ? toDateOnly(new Date(input.startDate))
      : isPurchase && firstPaymentDate
        ? defaultPurchaseDate(firstPaymentDate)
        : undefined;
    if (
      isPurchase &&
      startDate &&
      firstPaymentDate &&
      startDate >= firstPaymentDate
    ) {
      throw new ValidationError(
        'The purchase date must be before the first payment',
      );
    }

    // The payment schedule: fixed-term loans always, personal ones when
    // they have a frequency and a payment amount.
    const rule: ScheduleRule | null =
      frequency && firstPaymentDate && terms.installmentAmount
        ? { frequency, interval: 1, startDate: firstPaymentDate }
        : null;
    if (rule && input.installmentsTotal && !isPurchase) {
      const dates = dueDatesAfter(
        rule,
        addDays(firstPaymentDate!, -1),
        input.installmentsTotal,
      );
      rule.endDate = dates[dates.length - 1];
    }

    // Scheduled payments made before registering the loan. Detected charges
    // of a suggestion count as some of them (they have their movements).
    const detected = fromSuggestion?.history ?? [];
    const installmentsPaid = Math.max(
      input.installmentsPaid ?? 0,
      detected.length,
    );
    if (installmentsPaid > 0 && !rule) {
      throw new ValidationError(
        'Payments already made need a payment schedule; list them as historical payments instead',
      );
    }
    if (input.installmentsTotal && installmentsPaid > input.installmentsTotal) {
      throw new ValidationError(
        'Payments already made cannot exceed the number of payments',
      );
    }
    const scheduledHistory = rule
      ? this.scheduledHistory(
          rule,
          terms,
          input.installmentsTotal ?? null,
          installmentsPaid - detected.length,
          detected,
        )
      : [];

    const explicit = (input.historicalPayments ?? []).map((p) => {
      if (!(p.amount > 0)) {
        throw new ValidationError('Historical payments must be greater than 0');
      }
      return { ...p, date: toDateOnly(new Date(p.date)) };
    });
    const paid =
      scheduledHistory.reduce((sum, p) => sum + p.amount, 0) +
      explicit.reduce((sum, p) => sum + p.amount, 0) +
      detected.reduce((sum, p) => sum + p.amount, 0);
    if (paid > terms.totalToRepay + CENT) {
      throw new DebtOverpaymentError(
        `Payments made (${cents(paid)}) exceed the amount to repay (${terms.totalToRepay})`,
      );
    }

    const openingFee = input.openingFee ? cents(input.openingFee) : 0;
    if (openingFee > 0 && loanType !== LoanType.institutional) {
      throw new ValidationError(
        'Only bank or lender loans have an opening fee',
      );
    }
    if (openingFee < 0 || (openingFee > 0 && openingFee >= input.principal)) {
      throw new ValidationError(
        'The opening fee must be less than the amount borrowed',
      );
    }

    // A personal loan may start at 0: its amounts are added one by one.
    const destination =
      input.principal > 0
        ? (input.destination ??
          (isPurchase ? DebtChargeDestination.purchase : undefined))
        : undefined;
    if (
      destination === DebtChargeDestination.deposit &&
      !input.depositAccountId
    ) {
      throw new ValidationError('Choose the account that received the money');
    }

    const paymentAccount = input.paymentAccountId
      ? await this.prisma.account.findFirst({
          where: { id: input.paymentAccountId, userId },
          select: { type: true, currency: true },
        })
      : null;
    if (input.paymentAccountId && !paymentAccount) {
      throw new NotFoundError('Payment account not found');
    }
    if (input.linkedAccountId) {
      const linked = await this.prisma.account.findFirst({
        where: { id: input.linkedAccountId, userId },
        select: { id: true },
      });
      if (!linked) throw new NotFoundError('Linked account not found');
    }

    const minPaymentAmount =
      input.minPaymentAmount ??
      (terms.installmentAmount && frequency
        ? monthlyEquivalent(terms.installmentAmount, frequency, 1)
        : undefined);

    const categoryId =
      input.categoryId ??
      (await this.paymentCategoryId(userId, loanType)) ??
      fromSuggestion?.categoryId;
    const purposeCategoryId = await this.purposeCategoryId(
      userId,
      input.purposeCategoryId,
    );

    const lender = await this.lender(userId, loanType, {
      contactId: input.lenderContactId,
      name: input.lenderName,
    });

    const writeDebt = async (tx: Tx) => {
      const debt = await tx.debt.create({
        data: {
          userId,
          name,
          kind: DebtKind.loan,
          loanType,
          lenderName: lender.name,
          lenderContactId: lender.contactId,
          lendingMethod: input.lendingMethod,
          principal: input.principal,
          interestRateAnnual: input.interestRateAnnual,
          minPaymentAmount,
          startDate,
          dueDate: input.dueDate ?? rule?.endDate ?? undefined,
          linkedAccountId: input.linkedAccountId,
          paymentFrequency: frequency,
          installmentsTotal: input.installmentsTotal,
          installmentAmount: terms.installmentAmount,
          totalToRepay: terms.totalToRepay,
          interestMode: input.interestMode,
          includesVat: input.includesVat ?? false,
          openingFee: openingFee > 0 ? openingFee : null,
          periodicFee: periodicFee > 0 ? periodicFee : null,
          destination,
          purposeCategoryId,
        },
      });

      if (destination === DebtChargeDestination.deposit) {
        // The opening fee never reaches the account (not an expense).
        const deposit = await this.deposit(tx, userId, {
          accountId: input.depositAccountId!,
          amount: cents(input.principal - openingFee),
          date: startDate ?? toDateOnly(new Date()),
          description: name,
          countsAsIncome: input.depositCountsAsIncome ?? false,
        });
        await tx.debt.update({
          where: { id: debt.id },
          data: { disbursementTransactionId: deposit.id },
        });
      }

      const payments: Prisma.DebtPaymentCreateManyInput[] = [
        ...scheduledHistory.map((p) => ({
          debtId: debt.id,
          amount: p.amount,
          date: p.dueDate,
          isHistorical: true,
        })),
        ...detected.map((p) => ({
          debtId: debt.id,
          transactionId: p.transactionId,
          amount: p.amount,
          date: p.dueDate,
        })),
      ];
      for (const payment of explicit) {
        // With an account it counts in totals: a real expense movement.
        const movement = payment.accountId
          ? await createMovement(tx, {
              userId,
              accountId: payment.accountId,
              type: TransactionType.expense,
              amount: payment.amount,
              date: payment.date,
              description: name,
              categoryId: payment.categoryId ?? categoryId,
            })
          : null;
        if (payment.accountId && !movement) {
          throw new NotFoundError('Account not found');
        }
        payments.push({
          debtId: debt.id,
          transactionId: movement?.id ?? null,
          isHistorical: !movement,
          amount: payment.amount,
          date: payment.date,
        });
      }
      if (payments.length > 0) {
        await tx.debtPayment.createMany({ data: payments });
      }
      await fromSuggestion?.afterCreate(tx);
      return debt;
    };

    let debtId: string | undefined;
    if (rule) {
      const history: PaidHistoryItem[] = [
        ...scheduledHistory.map((p) => ({
          transactionId: null,
          dueDate: p.dueDate,
          amount: p.amount,
          matchedBy: OccurrenceMatchSource.manual,
        })),
        ...detected,
      ];
      await this.recurring.createWithHistory(
        userId,
        {
          name,
          kind: RecurringExpenseKind.loan,
          trackingMode:
            input.trackingMode ??
            (paymentAccount?.type === AccountType.credit ||
            paymentAccount?.type === AccountType.debit
              ? RecurringTrackingMode.automatic
              : RecurringTrackingMode.manual),
          frequency: rule.frequency,
          interval: 1,
          startDate: rule.startDate,
          endDate: rule.endDate ?? undefined,
          amount: terms.installmentAmount!,
          isVariableAmount: isPurchase,
          currency: paymentAccount?.currency ?? 'MXN',
          accountId: input.paymentAccountId,
          categoryId,
          merchantPattern: input.merchantPattern,
          // Purchase financing has no fixed count: every purchase adds some.
          installmentsTotal: isPurchase ? undefined : input.installmentsTotal,
          installmentsPaid: isPurchase ? 0 : installmentsPaid,
        },
        history,
        {
          syncFrom: this.syncFrom(rule, scheduledHistory, detected),
          afterCreate: async (tx, expense) => {
            const debt = await writeDebt(tx);
            debtId = debt.id;
            await tx.recurringExpense.update({
              where: { id: expense.id },
              data: { debtId: debt.id },
            });
          },
        },
      );
    } else {
      debtId = (await this.prisma.$transaction((tx) => writeDebt(tx))).id;
    }

    await this.prisma.$transaction(async (tx) => {
      await syncDebtStatus(tx, debtId!);
      // The schedule was generated before the expense was linked to the
      // debt, so purchase financing gets its per-date amounts now.
      await this.recurring.resyncLoanOccurrences(tx, debtId!);
    });
    return this.debts.findById(debtId!, userId);
  }

  /** A recurring suggestion the user says pays a loan becomes that loan. */
  async acceptSuggestion(
    userId: string,
    fingerprint: string,
    input: AcceptSuggestionAsLoanInput,
  ): Promise<Debt> {
    const { suggestion, state, history } = await this.suggestions.prepare(
      userId,
      fingerprint,
    );
    if (!input.principal) {
      throw new ValidationError('The amount borrowed is required');
    }

    const frequency =
      input.paymentFrequency ??
      (suggestion.interval === 1
        ? suggestion.frequency
        : suggestion.frequency === RecurringFrequency.weekly &&
            suggestion.interval === 2
          ? RecurringFrequency.biweekly
          : null);
    if (!frequency) throw new ValidationError('Choose the payment frequency');

    const loanType =
      input.loanType ?? state?.aiLoanType ?? guessLoanType(suggestion.merchant);
    const interestMode =
      input.interestMode ??
      (loanType === LoanType.personal
        ? undefined
        : LoanInterestMode.installment_amount);
    const firstPaymentDate = input.firstPaymentDate ?? history[0].dueDate;
    if (
      (input.installmentsPaid ?? 0) > history.length &&
      !input.firstPaymentDate
    ) {
      throw new ValidationError(
        'Payments were made before the detected ones: give the first payment date',
      );
    }

    return this.create(
      userId,
      {
        ...input,
        kind: DebtKind.loan,
        principal: input.principal,
        name:
          input.name?.trim() || state?.aiName || titleCase(suggestion.merchant),
        lenderName:
          input.lenderName ??
          state?.aiLenderName ??
          titleCase(suggestion.merchant),
        loanType,
        paymentFrequency: frequency,
        interestMode,
        installmentAmount:
          input.installmentAmount ??
          (interestMode === LoanInterestMode.installment_amount ||
          loanType === LoanType.personal
            ? suggestion.amount
            : undefined),
        firstPaymentDate,
        paymentAccountId:
          input.paymentAccountId ?? suggestion.accountId ?? undefined,
        merchantPattern: input.merchantPattern ?? suggestion.merchant,
      },
      {
        history,
        categoryId: state?.aiCategoryId ?? suggestion.categoryId ?? undefined,
        afterCreate: (tx) =>
          this.suggestions.markAccepted(tx, userId, fingerprint),
      },
    );
  }

  /** Money added to a loan: another personal loan or a financed purchase. */
  async addCharge(userId: string, input: AddDebtChargeInput): Promise<Debt> {
    const debt = await this.prisma.debt.findFirst({
      where: { id: input.debtId, userId },
      include: DEBT_INCLUDE,
    });
    if (!debt) throw new NotFoundError('Debt not found');
    if (debt.kind !== DebtKind.loan) {
      throw new ValidationError('Only loans can get more money');
    }
    if (!(input.principal > 0)) {
      throw new ValidationError('The amount must be greater than 0');
    }
    this.assertRate(input.interestRateAnnual);
    const isPurchase = debt.loanType === LoanType.purchase_financing;
    if (isPurchase && !input.installments) {
      throw new ValidationError(
        'A financed purchase needs its number of payments',
      );
    }
    if (
      input.destination === DebtChargeDestination.deposit &&
      !input.depositAccountId
    ) {
      throw new ValidationError('Choose the account that received the money');
    }

    const terms = this.resolveTerms({
      principal: input.principal,
      installments: input.installments,
      frequency: debt.paymentFrequency ?? RecurringFrequency.monthly,
      interestMode:
        input.interestMode ??
        (input.installments ? LoanInterestMode.total_amount : undefined),
      interestRateAnnual: input.interestRateAnnual,
      includesVat: input.includesVat,
      totalToRepay: input.totalToRepay ?? input.principal,
      installmentAmount: input.installmentAmount,
    });
    const date = toDateOnly(new Date(input.date));
    const purposeCategoryId = await this.purposeCategoryId(
      userId,
      input.purposeCategoryId,
    );

    await this.prisma.$transaction(async (tx) => {
      const deposit =
        input.destination === DebtChargeDestination.deposit
          ? await this.deposit(tx, userId, {
              accountId: input.depositAccountId!,
              amount: input.principal,
              date,
              description: input.description?.trim() || debt.name,
              countsAsIncome: input.depositCountsAsIncome ?? false,
            })
          : null;
      await tx.debtCharge.create({
        data: {
          debtId: debt.id,
          date,
          description: input.description?.trim() || null,
          principal: input.principal,
          totalToRepay: terms.totalToRepay,
          installments: input.installments,
          destination: input.destination,
          transactionId: deposit?.id,
          purposeCategoryId,
          lendingMethod: input.lendingMethod,
        },
      });
      await syncDebtStatus(tx, debt.id);
      await this.recurring.resyncLoanOccurrences(tx, debt.id);
    });

    return this.debts.findById(debt.id, userId);
  }

  async deleteCharge(userId: string, id: string): Promise<Debt> {
    const charge = await this.prisma.debtCharge.findFirst({
      where: { id, debt: { userId } },
    });
    if (!charge) throw new NotFoundError('Charge not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.debtCharge.delete({ where: { id } });
      if (charge.transactionId) await deleteDeposit(tx, charge.transactionId);
      await this.recurring.resyncLoanOccurrences(tx, charge.debtId);
      await syncDebtStatus(tx, charge.debtId);
    });

    return this.debts.findById(charge.debtId, userId);
  }

  /**
   * A new payment made from one of the user's accounts: the expense movement
   * (it counts in totals), the debt payment and its scheduled payment, in
   * one DB transaction.
   */
  async recordPayment(
    userId: string,
    input: RecordDebtPaymentInput,
  ): Promise<Debt> {
    if (!(input.amount > 0)) {
      throw new ValidationError('The payment must be greater than 0');
    }
    const debt = await this.prisma.debt.findFirst({
      where: { id: input.debtId, userId },
      include: {
        ...DEBT_INCLUDE,
        recurringExpense: {
          select: { id: true, nextDueDate: true, categoryId: true },
        },
      },
    });
    if (!debt) throw new NotFoundError('Debt not found');
    const balance = balanceOf(debt);
    if (input.amount > balance + CENT) {
      throw new DebtOverpaymentError(
        `Payment amount (${input.amount}) exceeds remaining debt balance (${balance})`,
      );
    }
    const account = await this.prisma.account.findFirst({
      where: { id: input.accountId, userId },
      select: { currency: true },
    });
    if (!account) throw new NotFoundError('Account not found');

    const date = toDateOnly(new Date(input.date));
    await this.transactions.create(
      userId,
      {
        accountId: input.accountId,
        categoryId:
          input.categoryId ??
          debt.recurringExpense?.categoryId ??
          (debt.kind === DebtKind.loan
            ? await this.paymentCategoryId(userId, debt.loanType)
            : undefined),
        type: TransactionType.expense,
        amount: input.amount,
        currency: account.currency,
        txnDate: date,
        description: debt.name,
        merchantName: debt.lenderName ?? debt.name,
      },
      {
        within: async (tx, created) => {
          await tx.debtPayment.create({
            data: {
              debtId: debt.id,
              transactionId: created.id,
              amount: input.amount,
              date,
            },
          });
          await this.debts.payScheduled(
            tx,
            debt.id,
            created.id,
            date,
            input.occurrenceId,
          );
          await syncDebtStatus(tx, debt.id);
        },
      },
    );

    return this.debts.findById(debt.id, userId);
  }

  private assertRate(rate?: number | null) {
    if (rate != null && !(rate >= 0 && rate <= MAX_ANNUAL_RATE)) {
      throw new ValidationError(
        `The annual interest rate must be between 0 and ${MAX_ANNUAL_RATE}`,
      );
    }
  }

  /** Total to repay and payment amount from whichever value was given. */
  private resolveTerms(input: {
    principal: number;
    installments?: number | null;
    frequency: RecurringFrequency;
    interestMode?: LoanInterestMode | null;
    interestRateAnnual?: number | null;
    includesVat?: boolean | null;
    totalToRepay?: number | null;
    installmentAmount?: number | null;
    periodicFee?: number;
  }): ResolvedTerms {
    if (input.installments && input.interestMode) {
      try {
        const terms = resolveLoanTerms({
          mode: input.interestMode,
          principal: input.principal,
          installments: input.installments,
          frequency: input.frequency,
          annualRatePercent: input.interestRateAnnual ?? undefined,
          includesVat: input.includesVat ?? false,
          totalToRepay: input.totalToRepay ?? undefined,
          installmentAmount: input.installmentAmount ?? undefined,
          periodicFee: input.periodicFee,
        });
        return {
          totalToRepay: terms.totalToRepay,
          installmentAmount: terms.installmentAmount,
        };
      } catch (error) {
        if (error instanceof LoanTermsError) {
          throw new ValidationError(error.message);
        }
        throw error;
      }
    }
    const totalToRepay = cents(input.totalToRepay ?? input.principal);
    if (totalToRepay < input.principal) {
      throw new ValidationError(
        'The total to repay cannot be less than the principal',
      );
    }
    return {
      totalToRepay,
      installmentAmount: input.installmentAmount ?? null,
    };
  }

  /**
   * The first `count` scheduled payments, recorded as made before the loan
   * was registered. They must all fall before the detected charges.
   */
  private scheduledHistory(
    rule: ScheduleRule,
    terms: ResolvedTerms,
    installmentsTotal: number | null,
    count: number,
    detected: PaidHistoryItem[],
  ): { dueDate: Date; amount: number }[] {
    if (count <= 0) return [];
    const dates = dueDatesAfter(rule, addDays(rule.startDate, -1), count);
    const firstDetected = detected[0]?.dueDate;
    if (
      firstDetected &&
      dates.some((date) => date >= toDateOnly(firstDetected))
    ) {
      throw new ValidationError(
        'The first payment date is too late for the payments already made',
      );
    }
    const each = terms.installmentAmount!;
    // The last installment takes what the equal ones leave.
    const last =
      installmentsTotal !== null
        ? cents(terms.totalToRepay - each * (installmentsTotal - 1))
        : each;
    return dates.map((dueDate, i) => ({
      dueDate,
      amount:
        installmentsTotal !== null && i === installmentsTotal - 1 ? last : each,
    }));
  }

  /** Scheduled payments are generated after the last one already paid. */
  private syncFrom(
    rule: ScheduleRule,
    scheduled: { dueDate: Date }[],
    detected: PaidHistoryItem[],
  ): Date | undefined {
    const candidates: Date[] = [];
    const lastScheduled = scheduled[scheduled.length - 1];
    if (lastScheduled) {
      const [next] = dueDatesAfter(rule, lastScheduled.dueDate, 1);
      if (next) candidates.push(next);
    }
    const lastDetected = detected[detected.length - 1];
    if (lastDetected) {
      // Scheduled dates near the last charge are already paid by it.
      candidates.push(
        addDays(
          lastDetected.dueDate,
          Math.ceil(FREQUENCY_DAYS[rule.frequency] / 2),
        ),
      );
    }
    if (candidates.length === 0) return undefined;
    return new Date(Math.max(...candidates.map((d) => d.getTime())));
  }

  /** The borrowed money arriving in an account (not income unless asked). */
  /**
   * Edits a loan. A new amount, number of payments or fee recomputes the
   * terms the same way they were given (rate, total or payment amount),
   * reprices the open scheduled payments and moves the end of the
   * schedule; a new amount or opening fee also corrects the deposit.
   */
  async update(
    userId: string,
    id: string,
    input: UpdateLoanInput,
  ): Promise<Debt> {
    const debt = await this.prisma.debt.findFirst({
      where: { id, userId, kind: DebtKind.loan },
      include: {
        ...DEBT_INCLUDE,
        recurringExpense: true,
        disbursementTransaction: true,
      },
    });
    if (!debt) throw new NotFoundError('Debt not found');

    const name = input.name?.trim();
    if (input.name !== undefined && !name) {
      throw new ValidationError('The name cannot be empty');
    }
    if (name && name !== debt.name) {
      const taken = await this.prisma.debt.findFirst({
        where: { userId, name, id: { not: id } },
        select: { id: true },
      });
      if (taken)
        throw new ConflictError('A debt with this name already exists');
    }

    const institutional = debt.loanType === LoanType.institutional;
    const byRate = debt.interestMode === LoanInterestMode.rate;
    const isPurchase = debt.loanType === LoanType.purchase_financing;
    const principal = input.principal ?? Number(debt.principal);
    if (input.principal !== undefined) {
      this.assertPrincipal(input.principal, debt.loanType);
    }
    const installments = input.installmentsTotal ?? debt.installmentsTotal;
    if (input.installmentsTotal !== undefined && !debt.interestMode) {
      throw new ValidationError(
        'Only fixed-term loans have a number of payments',
      );
    }
    const openingFee = cents(input.openingFee ?? Number(debt.openingFee ?? 0));
    if (input.openingFee && !institutional) {
      throw new ValidationError(
        'Only bank or lender loans have an opening fee',
      );
    }
    if (openingFee > 0 && openingFee >= principal) {
      throw new ValidationError(
        'The opening fee must be less than the amount borrowed',
      );
    }
    const periodicFee = cents(
      input.periodicFee ?? Number(debt.periodicFee ?? 0),
    );
    if (input.periodicFee && !(institutional && byRate)) {
      throw new ValidationError(
        'Only bank or lender loans given by their rate have a fee per payment',
      );
    }
    const purposeCategoryId =
      input.purposeCategoryId !== undefined
        ? await this.purposeCategoryId(userId, input.purposeCategoryId)
        : undefined;
    const lender =
      input.lenderContactId !== undefined || input.lenderName !== undefined
        ? await this.lender(userId, debt.loanType, {
            contactId: input.lenderContactId,
            name: input.lenderName,
          })
        : null;

    // Terms again, from what defined them, when something they use changed.
    const termsChanged =
      (input.principal !== undefined &&
        input.principal !== Number(debt.principal)) ||
      (input.installmentsTotal !== undefined &&
        input.installmentsTotal !== debt.installmentsTotal) ||
      (input.periodicFee !== undefined &&
        periodicFee !== Number(debt.periodicFee ?? 0));
    const terms = termsChanged
      ? this.resolveTerms({
          principal,
          installments,
          frequency: debt.paymentFrequency ?? RecurringFrequency.monthly,
          interestMode: debt.interestMode,
          interestRateAnnual:
            debt.interestRateAnnual === null
              ? null
              : Number(debt.interestRateAnnual),
          includesVat: debt.includesVat,
          totalToRepay:
            debt.interestMode === LoanInterestMode.total_amount ||
            !debt.interestMode
              ? Number(debt.totalToRepay ?? principal)
              : null,
          // Ignored in rate and total modes; a personal loan keeps its payment.
          installmentAmount:
            debt.installmentAmount === null
              ? null
              : Number(debt.installmentAmount),
          periodicFee: periodicFee > 0 ? periodicFee : undefined,
        })
      : null;
    if (terms) {
      const paid = debt.payments.reduce((s, p) => s + Number(p.amount), 0);
      const owed =
        terms.totalToRepay +
        (totalOwedOf(debt) - Number(debt.totalToRepay ?? debt.principal));
      if (paid > owed + CENT) {
        throw new DebtOverpaymentError(
          `Payments made (${cents(paid)}) exceed the new amount to repay (${cents(owed)})`,
        );
      }
    }

    const expense = debt.recurringExpense;
    if (
      expense &&
      installments &&
      !isPurchase &&
      expense.installmentsPaid > installments
    ) {
      throw new ValidationError(
        'The number of payments cannot be less than the payments already made',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // The deposit is what reached the account: principal − opening fee.
      const deposit = debt.disbursementTransaction;
      const depositDelta = cents(
        principal -
          openingFee -
          (Number(debt.principal) - Number(debt.openingFee ?? 0)),
      );
      if (deposit && depositDelta !== 0) {
        await tx.transaction.update({
          where: { id: deposit.id },
          data: { amount: cents(Number(deposit.amount) + depositDelta) },
        });
        if (!deposit.isPending) {
          await tx.account.update({
            where: { id: deposit.accountId },
            data: { balanceCurrent: { increment: depositDelta } },
          });
        }
      }

      await tx.debt.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(lender && {
            lenderName: lender.name,
            lenderContactId: lender.contactId,
          }),
          ...(input.startDate !== undefined && {
            startDate: input.startDate
              ? toDateOnly(new Date(input.startDate))
              : null,
          }),
          ...(input.lendingMethod !== undefined && {
            lendingMethod: input.lendingMethod,
          }),
          ...(purposeCategoryId !== undefined && { purposeCategoryId }),
          ...(input.openingFee !== undefined && {
            openingFee: openingFee > 0 ? openingFee : null,
          }),
          ...(input.periodicFee !== undefined && {
            periodicFee: periodicFee > 0 ? periodicFee : null,
          }),
          principal,
          ...(terms && {
            installmentsTotal: installments,
            // A personal loan without interest owes its principal (null).
            totalToRepay:
              !debt.interestMode && debt.totalToRepay === null
                ? null
                : terms.totalToRepay,
            installmentAmount: terms.installmentAmount,
            ...(terms.installmentAmount &&
              debt.paymentFrequency && {
                minPaymentAmount: monthlyEquivalent(
                  terms.installmentAmount,
                  debt.paymentFrequency,
                  1,
                ),
              }),
          }),
        },
      });

      if (expense && terms && !isPurchase) {
        const amount = terms.installmentAmount ?? Number(expense.amount);
        const endDate =
          installments && debt.interestMode
            ? dueDatesAfter(
                expense,
                addDays(expense.startDate, -1),
                installments,
              ).at(-1)
            : undefined;
        await tx.recurringExpense.update({
          where: { id: expense.id },
          data: {
            amount,
            ...(endDate && {
              endDate,
              installmentsTotal: installments,
              active: expense.installmentsPaid < installments!,
            }),
          },
        });
        if (endDate) {
          await tx.recurringOccurrence.deleteMany({
            where: {
              recurringExpenseId: expense.id,
              status: OccurrenceStatus.upcoming,
              dueDate: { gt: endDate },
            },
          });
        }
        await tx.recurringOccurrence.updateMany({
          where: {
            recurringExpenseId: expense.id,
            status: OccurrenceStatus.upcoming,
          },
          data: { expectedAmount: amount },
        });
        // Payments made before registering it were assumed from the terms
        // (paid occurrences without a movement): they follow the new ones.
        const assumed = await tx.recurringOccurrence.findMany({
          where: {
            recurringExpenseId: expense.id,
            status: OccurrenceStatus.paid,
            transactionId: null,
          },
          select: { id: true, dueDate: true },
        });
        if (assumed.length > 0) {
          await tx.recurringOccurrence.updateMany({
            where: { id: { in: assumed.map((o) => o.id) } },
            data: { expectedAmount: amount },
          });
          await tx.debtPayment.updateMany({
            where: {
              debtId: id,
              isHistorical: true,
              transactionId: null,
              date: { in: assumed.map((o) => o.dueDate) },
            },
            data: { amount },
          });
          const after = await tx.debt.findUniqueOrThrow({
            where: { id },
            include: DEBT_INCLUDE,
          });
          const paid = after.payments.reduce((s, p) => s + Number(p.amount), 0);
          if (paid > totalOwedOf(after) + CENT) {
            throw new DebtOverpaymentError(
              `Payments made (${cents(paid)}) exceed the new amount to repay (${cents(totalOwedOf(after))})`,
            );
          }
        }
      }
      await syncDebtStatus(tx, id);
      if (isPurchase && terms) {
        await this.recurring.resyncLoanOccurrences(tx, id);
      }
    });
    if (expense && terms && !isPurchase && expense.active) {
      // A longer loan gets its new due dates within the usual window.
      const fresh = await this.prisma.recurringExpense.findUnique({
        where: { id: expense.id },
      });
      if (fresh?.active) await this.recurring.syncOccurrences(fresh);
    }
    return this.debts.findById(id, userId);
  }

  /**
   * Who lent it. Personal loans point at a contact: the one given, or one
   * named after `name` (created if needed). Other loans keep a plain name.
   */
  private async lender(
    userId: string,
    loanType: LoanType | null,
    given: { contactId?: string | null; name?: string | null },
  ): Promise<{ name: string | null; contactId: string | null }> {
    if (given.contactId) {
      if (loanType !== LoanType.personal) {
        throw new ValidationError('Only personal loans have a lender contact');
      }
      const contact = await this.contacts.findById(
        this.prisma,
        userId,
        given.contactId,
      );
      return { name: contact.name, contactId: contact.id };
    }
    const name = given.name?.trim() || null;
    if (name && loanType === LoanType.personal) {
      const contact = await this.contacts.findOrCreate(
        this.prisma,
        userId,
        name,
      );
      return { name: contact.name, contactId: contact.id };
    }
    return { name, contactId: null };
  }

  /**
   * What was lent at first: more than 0, except personal loans, which may
   * start at 0 and get each amount added later.
   */
  private assertPrincipal(principal: number, loanType: LoanType | null) {
    const personal = loanType === LoanType.personal;
    if (!(personal ? principal >= 0 : principal > 0)) {
      throw new ValidationError(
        personal
          ? 'The amount borrowed cannot be negative'
          : 'The principal must be greater than 0',
      );
    }
  }

  /** Loan Payments, or Installment Payments for purchase financing. */
  private paymentCategoryId(
    userId: string,
    loanType: LoanType | null,
  ): Promise<string | undefined> {
    return defaultCategoryId(
      this.prisma,
      userId,
      debtPaymentCategoryKey(
        loanType === LoanType.purchase_financing ? 'installment' : 'loan',
      ),
    );
  }

  /** What the money was for: one of the user's categories (informative). */
  private async purposeCategoryId(
    userId: string,
    id: string | undefined | null,
  ): Promise<string | null> {
    if (!id) return null;
    const category = await this.prisma.category.findFirst({
      where: { id, OR: [{ userId }, { userId: null, isDefault: true }] },
      select: { id: true },
    });
    if (!category) throw new NotFoundError('Category not found');
    return category.id;
  }

  private async deposit(
    tx: Tx,
    userId: string,
    input: {
      accountId: string;
      amount: number;
      date: Date;
      description: string;
      countsAsIncome: boolean;
    },
  ) {
    const movement = await createMovement(tx, {
      userId,
      accountId: input.accountId,
      type: input.countsAsIncome
        ? TransactionType.income
        : TransactionType.adjustment,
      amount: input.amount,
      date: input.date,
      description: input.description,
    });
    if (!movement) throw new NotFoundError('Deposit account not found');
    return movement;
  }
}
