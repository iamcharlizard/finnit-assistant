// Loan flows against a real, throwaway database (migrated with
// `prisma migrate deploy`). Skipped unless LOANS_TEST_DATABASE_URL is set:
//   LOANS_TEST_DATABASE_URL=postgresql://…/finnit_loans_check pnpm jest loans.integration
import { Test } from '@nestjs/testing';
import {
  AccountType,
  DebtChargeDestination,
  DebtKind,
  LoanInterestMode,
  LendingMethod,
  LoanType,
  OccurrenceStatus,
  RecurringFrequency,
  TransactionSource,
  TransactionType,
} from '@finnit/database';
import { PrismaService } from '../../services/prisma.service';
import { DebtsService } from './debts.service';
import { LoansService } from './loans.service';
import { LoanTrackingService } from './loan-tracking.service';
import { DebtInsightsService } from './debt-insights.service';
import { RecurringExpensesService } from '../recurring-expenses/recurring-expenses.service';
import { RecurringSuggestionsService } from '../recurring-expenses/suggestions/recurring-suggestions.service';
import { TransactionsService } from '../transactions/transactions.service';
import { ContactsService } from '../contacts/contacts.service';
import { AiModelsService } from '../ai/ai-models.service';
import { S3StorageService } from '../storage/s3-storage.service';
import { MerchantAliasesService } from '../categorization/merchant-aliases.service';
import { MerchantRulesService } from '../categorization/merchant-rules.service';
import {
  DebtOverpaymentError,
  ValidationError,
} from '../../common/exceptions/graphql-error.exception';
import { createDefaultCategories } from '../auth/default-categories';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const iso = (date: Date) => date.toISOString().slice(0, 10);

const DATABASE_URL = process.env.LOANS_TEST_DATABASE_URL;

(DATABASE_URL ? describe : describe.skip)('loans (integration)', () => {
  let prisma: PrismaService;
  let loans: LoansService;
  let tracking: LoanTrackingService;
  let insights: DebtInsightsService;
  let debts: DebtsService;
  let recurring: RecurringExpensesService;
  let suggestions: RecurringSuggestionsService;
  let userId: string;
  let debitId: string;
  const ai = { extractFromText: jest.fn() };

  beforeAll(async () => {
    process.env.DATABASE_URL = DATABASE_URL;
    const module = await Test.createTestingModule({
      providers: [
        PrismaService,
        DebtsService,
        LoansService,
        LoanTrackingService,
        DebtInsightsService,
        RecurringExpensesService,
        RecurringSuggestionsService,
        TransactionsService,
        ContactsService,
        { provide: AiModelsService, useValue: ai },
        { provide: S3StorageService, useValue: {} },
        {
          provide: MerchantAliasesService,
          useValue: { applyTo: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: MerchantRulesService,
          useValue: {
            match: jest.fn().mockResolvedValue(new Map()),
            categoryFor: jest.fn().mockResolvedValue(null),
          },
        },
      ],
    }).compile();
    prisma = module.get(PrismaService);
    await prisma.$connect();
    loans = module.get(LoansService);
    tracking = module.get(LoanTrackingService);
    insights = module.get(DebtInsightsService);
    debts = module.get(DebtsService);
    recurring = module.get(RecurringExpensesService);
    suggestions = module.get(RecurringSuggestionsService);

    const user = await prisma.user.create({
      data: { name: 'Loan check', email: `loans-${Date.now()}@test.local` },
    });
    userId = user.id;
    const account = await prisma.account.create({
      data: {
        userId,
        type: AccountType.debit,
        name: 'Débito',
        currency: 'MXN',
        balanceCurrent: 50_000,
      },
    });
    debitId = account.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const balance = async () =>
    Number(
      (await prisma.account.findUniqueOrThrow({ where: { id: debitId } }))
        .balanceCurrent,
    );
  const expenses = () =>
    prisma.transaction.count({
      where: {
        userId,
        type: TransactionType.expense,
        source: TransactionSource.manual,
      },
    });

  it('institutional loan: terms, deposit, historical payments, schedule, payment from an account', async () => {
    const debt = await loans.create(userId, {
      name: 'YoTePresto',
      kind: DebtKind.loan,
      loanType: LoanType.institutional,
      lenderName: 'YoTePresto',
      principal: 20_000,
      interestRateAnnual: 40,
      includesVat: true,
      interestMode: LoanInterestMode.rate,
      paymentFrequency: RecurringFrequency.monthly,
      installmentsTotal: 12,
      firstPaymentDate: d('2026-06-15'),
      startDate: d('2026-05-15'),
      installmentsPaid: 4,
      paymentAccountId: debitId,
      destination: DebtChargeDestination.deposit,
      depositAccountId: debitId,
      openingFee: 1_160,
    });

    expect(debt.openingFee).toBe(1_160);
    expect(debt.totalToRepay).toBeGreaterThan(20_000);
    expect(debt.installmentAmount! * 12).toBeCloseTo(debt.totalToRepay!, 0);
    expect(debt.payments).toHaveLength(4);
    expect(debt.payments.every((p) => p.isHistorical && !p.transactionId)).toBe(
      true,
    );
    expect(debt.historicalPaid).toBeCloseTo(debt.installmentAmount! * 4, 2);
    expect(debt.remainingBalance).toBeCloseTo(
      debt.totalToRepay! - debt.historicalPaid,
      2,
    );
    expect(debt.dueDate && iso(debt.dueDate)).toBe('2027-05-15');
    // The deposit is no income and no expense, but it adds to the account:
    // what was borrowed minus the opening fee.
    expect(await balance()).toBe(70_000 - 1_160);
    expect(await expenses()).toBe(0);
    const deposit = await prisma.transaction.findUniqueOrThrow({
      where: { id: debt.disbursementTransactionId! },
    });
    expect(deposit.type).toBe(TransactionType.adjustment);

    const occurrences = await prisma.recurringOccurrence.findMany({
      where: { recurringExpense: { debtId: debt.id } },
      orderBy: { dueDate: 'asc' },
    });
    expect(
      occurrences.slice(0, 4).map((o) => [iso(o.dueDate), o.status]),
    ).toEqual([
      ['2026-06-15', OccurrenceStatus.paid],
      ['2026-07-15', OccurrenceStatus.paid],
      ['2026-08-15', OccurrenceStatus.paid],
      ['2026-09-15', OccurrenceStatus.paid],
    ]);
    expect(iso(occurrences[4].dueDate)).toBe('2026-10-15');
    expect(occurrences[4].status).toBe(OccurrenceStatus.upcoming);

    // A new payment from the debit account counts as an expense and pays October.
    const paid = await loans.recordPayment(userId, {
      debtId: debt.id,
      accountId: debitId,
      amount: debt.installmentAmount!,
      date: d('2026-10-15'),
    });
    expect(paid.payments).toHaveLength(5);
    expect(await expenses()).toBe(1);
    expect(await balance()).toBeCloseTo(
      70_000 - 1_160 - debt.installmentAmount!,
      2,
    );
    const october = await prisma.recurringOccurrence.findUniqueOrThrow({
      where: { id: occurrences[4].id },
    });
    expect(october.status).toBe(OccurrenceStatus.paid);
    const expense = await prisma.recurringExpense.findUniqueOrThrow({
      where: { debtId: debt.id },
    });
    expect(expense.installmentsPaid).toBe(5);

    // Reopening the scheduled payment unlinks its debt payment.
    await recurring.reopenOccurrence(october.id, userId);
    const reopened = await debts.findById(debt.id, userId);
    expect(reopened.payments).toHaveLength(4);
    expect(
      (
        await prisma.recurringExpense.findUniqueOrThrow({
          where: { debtId: debt.id },
        })
      ).installmentsPaid,
    ).toBe(4);

    // Marking it paid without a movement is refused for loans.
    await expect(
      recurring.markOccurrencePaid(october.id, userId),
    ).rejects.toThrow('movement');
  });

  it('personal loan: historical payments (counted or not), charges that grow it, paid off', async () => {
    const start = await balance();
    const debt = await loans.create(userId, {
      name: 'Préstamo de mamá',
      kind: DebtKind.loan,
      loanType: LoanType.personal,
      lenderName: 'Mamá',
      principal: 10_000,
      historicalPayments: [
        { amount: 1_000, date: d('2026-08-01') },
        { amount: 2_000, date: d('2026-09-01'), accountId: debitId },
      ],
    });
    expect(debt.recurringExpenseId).toBeUndefined();
    expect(debt.remainingBalance).toBe(7_000);
    expect(debt.historicalPaid).toBe(1_000);
    // Only the payment with an account is a movement.
    expect(await balance()).toBe(start - 2_000);

    const grown = await loans.addCharge(userId, {
      debtId: debt.id,
      date: d('2026-10-01'),
      description: 'Para el coche',
      principal: 5_000,
      destination: DebtChargeDestination.deposit,
      depositAccountId: debitId,
    });
    expect(grown.remainingBalance).toBe(12_000);
    expect(grown.totalOwed).toBe(15_000);
    expect(await balance()).toBe(start + 3_000);

    const shrunk = await loans.deleteCharge(userId, grown.charges[0].id);
    expect(shrunk.remainingBalance).toBe(7_000);
    expect(await balance()).toBe(start - 2_000);

    await debts.createPayment(userId, {
      debtId: debt.id,
      isHistorical: true,
      amount: 7_000,
      date: d('2026-10-10'),
    });
    expect((await debts.findById(debt.id, userId)).status).toBe('paid_off');
  });

  it('purchase financing: every purchase adds its installments on the same due dates', async () => {
    const debt = await loans.create(userId, {
      name: 'Kueski',
      kind: DebtKind.loan,
      loanType: LoanType.purchase_financing,
      principal: 1_200,
      interestMode: LoanInterestMode.total_amount,
      totalToRepay: 1_300,
      installmentsTotal: 4,
      paymentFrequency: RecurringFrequency.semimonthly,
      firstPaymentDate: d('2026-11-15'),
      startDate: d('2026-11-01'),
      paymentAccountId: debitId,
    });
    expect(debt.destination).toBe(DebtChargeDestination.purchase);

    const amounts = async () =>
      (
        await prisma.recurringOccurrence.findMany({
          where: { recurringExpense: { debtId: debt.id } },
          orderBy: { dueDate: 'asc' },
        })
      )
        // How far ahead occurrences exist depends on today: compare up to Dec 15.
        .filter((o) => iso(o.dueDate) <= '2026-12-15')
        .map((o) => [iso(o.dueDate), Number(o.expectedAmount)]);
    expect(await amounts()).toEqual([
      ['2026-11-15', 325],
      ['2026-11-30', 325],
      ['2026-12-15', 325],
    ]);

    await loans.addCharge(userId, {
      debtId: debt.id,
      date: d('2026-11-20'),
      description: 'Audífonos',
      principal: 600,
      installments: 2,
      destination: DebtChargeDestination.purchase,
    });
    expect(await amounts()).toEqual([
      ['2026-11-15', 325],
      ['2026-11-30', 625],
      ['2026-12-15', 625],
    ]);
    expect((await debts.findById(debt.id, userId)).remainingBalance).toBe(
      1_900,
    );
  });

  it('a recurring suggestion becomes a loan, with AI describing it', async () => {
    for (const date of [
      '2026-07-05',
      '2026-08-05',
      '2026-09-05',
      '2026-10-05',
    ]) {
      await prisma.transaction.create({
        data: {
          userId,
          accountId: debitId,
          type: TransactionType.expense,
          amount: 1_500,
          currency: 'MXN',
          txnDate: d(date),
          description: 'PAGO KUBO FINANCIERO',
          merchantName: 'KUBO FINANCIERO',
          source: TransactionSource.imported,
        },
      });
    }
    const [suggestion] = await suggestions.list(userId);
    expect(suggestion).toBeDefined();

    ai.extractFromText.mockReset();
    ai.extractFromText.mockResolvedValueOnce({
      model: { modelId: 'test-model' },
      data: {
        name: 'Préstamo Kubo',
        lenderName: 'Kubo Financiero',
        loanType: 'institutional',
      },
    });
    const draft = await suggestions.loanDraft(userId, suggestion.fingerprint);
    expect(draft).toEqual(
      expect.objectContaining({
        name: 'Préstamo Kubo',
        lenderName: 'Kubo Financiero',
        loanType: LoanType.institutional,
        paymentFrequency: RecurringFrequency.monthly,
        installmentAmount: 1_500,
        paymentsDetected: 4,
        classifiedBy: 'ai',
      }),
    );
    // Cached: a second draft does not ask the AI again.
    await suggestions.loanDraft(userId, suggestion.fingerprint);
    expect(ai.extractFromText).toHaveBeenCalledTimes(1);

    const debt = await loans.acceptSuggestion(userId, suggestion.fingerprint, {
      principal: 15_000,
      installmentsTotal: 12,
      installmentsPaid: 6,
      firstPaymentDate: d('2026-05-05'),
    });
    expect(debt.name).toBe('Préstamo Kubo');
    expect(debt.totalToRepay).toBe(18_000);
    expect(debt.payments.filter((p) => p.transactionId)).toHaveLength(4);
    expect(
      debt.payments
        .filter((p) => p.isHistorical)
        .map((p) => iso(p.date))
        .sort(),
    ).toEqual(['2026-05-05', '2026-06-05']);
    expect(debt.remainingBalance).toBe(9_000);
    expect(await suggestions.list(userId)).toHaveLength(0);
  });

  it('lists the whole schedule and proposes bank movements for open payments', async () => {
    const debt = await loans.create(userId, {
      name: 'Préstamo Azteca',
      kind: DebtKind.loan,
      loanType: LoanType.institutional,
      lenderName: 'Banco Azteca',
      principal: 6_000,
      interestMode: LoanInterestMode.installment_amount,
      installmentAmount: 1_100,
      installmentsTotal: 6,
      paymentFrequency: RecurringFrequency.monthly,
      firstPaymentDate: d('2026-09-20'),
      installmentsPaid: 1,
      paymentAccountId: debitId,
    });

    const schedule = await tracking.schedule(userId, debt.id);
    expect(
      schedule.map((i) => [
        iso(i.dueDate),
        i.status,
        i.isHistorical,
        i.projected,
      ]),
    ).toEqual([
      ['2026-09-20', 'paid', true, false],
      ['2026-10-20', 'upcoming', false, false],
      ['2026-11-20', 'upcoming', false, false],
      ['2026-12-20', 'upcoming', false, false],
      ['2027-01-20', 'upcoming', false, true],
      ['2027-02-20', 'upcoming', false, true],
    ]);

    // A bank movement two days after October's payment, naming the lender.
    const movement = await prisma.transaction.create({
      data: {
        userId,
        accountId: debitId,
        type: TransactionType.expense,
        amount: 1_100,
        currency: 'MXN',
        txnDate: d('2026-10-22'),
        description: 'PAGO AZTECA 0021',
        merchantName: 'PAGO AZTECA 0021',
        source: TransactionSource.imported,
      },
    });
    const candidates = await tracking.paymentCandidates(userId, debt.id);
    expect(candidates).toEqual([
      expect.objectContaining({
        transactionId: movement.id,
        reason: 'text',
        expectedAmount: 1_100,
      }),
    ]);
    expect(iso(candidates[0].dueDate)).toBe('2026-10-20');

    const confirmed = await tracking.confirmPayment(
      userId,
      candidates[0].occurrenceId,
      movement.id,
    );
    expect(
      confirmed.payments.filter((p) => p.transactionId === movement.id),
    ).toHaveLength(1);
    expect(confirmed.remainingBalance).toBe(6_600 - 2_200);
    // The merchant is learned so later syncs reconcile on their own.
    const expense = await prisma.recurringExpense.findUniqueOrThrow({
      where: { debtId: debt.id },
    });
    expect(expense.merchantPattern).toBe('PAGO AZTECA');
    expect(await tracking.paymentCandidates(userId, debt.id)).toEqual([]);
  });

  it('sums the debts by type, payments by month and the projected balance', async () => {
    const result = await insights.insights(userId, { months: 12, horizon: 24 });
    const types = new Map(result.byType.map((t) => [t.type, t]));
    expect(types.get('institutional')?.count).toBeGreaterThanOrEqual(2);
    expect(types.get('purchase_financing')?.remaining).toBe(1_900);
    // The YoTePresto loan registered 4 payments made before (June–September).
    const june = result.paidByMonth.find((m) => m.month === '2026-06');
    expect(june?.historical).toBeGreaterThan(0);
    expect(june?.counted).toBe(0);
    const owed = result.byType
      .filter((t) => t.type !== 'msi')
      .reduce((sum, t) => sum + t.remaining, 0);
    expect(result.projection).toHaveLength(24);
    expect(result.projection[0].debt).toBeLessThan(owed);
    expect(result.projection[23].debt).toBeLessThanOrEqual(
      result.projection[0].debt,
    );
    expect(result.upcoming.days90).toBeGreaterThanOrEqual(
      result.upcoming.days30,
    );
    expect(result.monthlyPayments).toBeGreaterThan(0);
  });

  it('refuses incomplete or inconsistent loans', async () => {
    const base = {
      name: 'Banco',
      kind: DebtKind.loan,
      loanType: LoanType.institutional,
      principal: 10_000,
      interestMode: LoanInterestMode.total_amount,
      totalToRepay: 12_000,
      installmentsTotal: 12,
      paymentFrequency: RecurringFrequency.monthly,
      firstPaymentDate: d('2026-11-01'),
    };
    // An opening fee: bank or lender loans only, and below the principal.
    await expect(
      loans.create(userId, { ...base, openingFee: 10_000 }),
    ).rejects.toThrow(ValidationError);
    await expect(
      loans.create(userId, {
        ...base,
        loanType: LoanType.personal,
        openingFee: 100,
      }),
    ).rejects.toThrow(ValidationError);
    // Fixed-term loans need a schedule.
    await expect(
      loans.create(userId, { ...base, paymentFrequency: undefined }),
    ).rejects.toThrow(ValidationError);
    // Less to repay than borrowed.
    await expect(
      loans.create(userId, { ...base, totalToRepay: 9_000 }),
    ).rejects.toThrow(ValidationError);
    // More payments made than the loan has.
    await expect(
      loans.create(userId, { ...base, installmentsPaid: 13 }),
    ).rejects.toThrow(ValidationError);
    // Past payments worth more than the loan.
    await expect(
      loans.create(userId, {
        ...base,
        loanType: LoanType.personal,
        historicalPayments: [{ amount: 20_000, date: d('2026-10-01') }],
      }),
    ).rejects.toThrow(DebtOverpaymentError);
    // A deposit needs its account; a purchase needs its installments.
    await expect(
      loans.create(userId, {
        ...base,
        destination: DebtChargeDestination.deposit,
      }),
    ).rejects.toThrow(ValidationError);
    expect(await prisma.debt.count({ where: { userId, name: 'Banco' } })).toBe(
      0,
    );
  });

  it('adds a fixed fee to every payment and reprices the open ones when it changes', async () => {
    const debt = await loans.create(userId, {
      name: 'YoTePresto comisión',
      kind: DebtKind.loan,
      loanType: LoanType.institutional,
      principal: 200_000,
      interestMode: LoanInterestMode.rate,
      interestRateAnnual: 18.9,
      includesVat: true,
      periodicFee: 299,
      paymentFrequency: RecurringFrequency.monthly,
      installmentsTotal: 24,
      firstPaymentDate: d('2027-01-27'),
      paymentAccountId: debitId,
    });
    expect(debt.installmentAmount).toBe(10_667.13);
    expect(debt.periodicFee).toBe(299);
    const open = () =>
      prisma.recurringOccurrence.findMany({
        where: { recurringExpense: { debtId: debt.id }, status: 'upcoming' },
      });

    // The amortization table splits each payment.
    const table = await tracking.schedule(userId, debt.id);
    expect(table[0]).toMatchObject({
      amount: 10_667.13,
      principal: 6_714.13,
      interest: 3_150,
      vat: 504,
      fee: 299,
      balance: 193_285.87,
    });
    expect(table.at(-1)?.balance).toBe(0);

    const without = await loans.update(userId, debt.id, { periodicFee: 0 });
    expect(without.installmentAmount).toBe(10_368.13);
    expect(without.periodicFee).toBeUndefined();
    expect(
      (
        await prisma.recurringExpense.findUniqueOrThrow({
          where: { debtId: debt.id },
        })
      ).amount.toNumber(),
    ).toBe(10_368.13);
    for (const o of await open()) {
      expect(o.expectedAmount.toNumber()).toBe(10_368.13);
    }

    // Fewer payments: a higher payment and no due dates after the new end.
    const shorter = await loans.update(userId, debt.id, {
      installmentsTotal: 12,
      name: 'YoTePresto 12',
      lenderName: 'YoTePresto',
    });
    expect(shorter.name).toBe('YoTePresto 12');
    expect(shorter.installmentsTotal).toBe(12);
    expect(shorter.installmentAmount).toBeGreaterThan(10_368.13);
    const expense = await prisma.recurringExpense.findUniqueOrThrow({
      where: { debtId: debt.id },
    });
    expect(iso(expense.endDate!)).toBe('2027-12-27');
    for (const o of await open()) {
      expect(iso(o.dueDate) <= '2027-12-27').toBe(true);
      expect(o.expectedAmount.toNumber()).toBe(shorter.installmentAmount);
    }
    await expect(
      loans.update(userId, debt.id, { name: 'Kueski' }),
    ).rejects.toThrow('already exists');

    await expect(
      loans.create(userId, {
        name: 'Kueski con comisión',
        kind: DebtKind.loan,
        loanType: LoanType.purchase_financing,
        principal: 1_000,
        interestMode: LoanInterestMode.total_amount,
        totalToRepay: 1_200,
        installmentsTotal: 4,
        paymentFrequency: RecurringFrequency.semimonthly,
        firstPaymentDate: d('2026-11-15'),
        periodicFee: 50,
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('reprices the payments assumed before registering when the terms change', async () => {
    const debt = await loans.create(userId, {
      name: 'YoTePresto previos',
      kind: DebtKind.loan,
      loanType: LoanType.institutional,
      principal: 200_000,
      interestMode: LoanInterestMode.rate,
      interestRateAnnual: 18.9,
      includesVat: true,
      paymentFrequency: RecurringFrequency.monthly,
      installmentsTotal: 24,
      firstPaymentDate: d('2026-01-26'),
      installmentsPaid: 10,
      paymentAccountId: debitId,
    });
    expect(debt.totalPaid).toBeCloseTo(103_681.3, 2);

    const withFee = await loans.update(userId, debt.id, { periodicFee: 299 });
    expect(withFee.totalPaid).toBeCloseTo(106_671.3, 2);
    expect(withFee.remainingBalance).toBeCloseTo(
      withFee.totalOwed - 106_671.3,
      2,
    );
    expect(
      (await prisma.debtPayment.findMany({ where: { debtId: debt.id } })).every(
        (p) => p.amount.toNumber() === 10_667.13,
      ),
    ).toBe(true);
  });

  it('edits the amount and opening fee and corrects the deposit', async () => {
    const before = await balance();
    const debt = await loans.create(userId, {
      name: 'Préstamo editable',
      kind: DebtKind.loan,
      loanType: LoanType.institutional,
      principal: 10_000,
      interestMode: LoanInterestMode.total_amount,
      totalToRepay: 12_000,
      installmentsTotal: 6,
      paymentFrequency: RecurringFrequency.monthly,
      firstPaymentDate: d('2027-02-01'),
      destination: DebtChargeDestination.deposit,
      depositAccountId: debitId,
      openingFee: 500,
    });
    expect(await balance()).toBe(before + 9_500);

    const edited = await loans.update(userId, debt.id, {
      principal: 11_000,
      openingFee: 0,
      startDate: d('2027-01-10'),
    });
    expect(await balance()).toBe(before + 11_000);
    expect(edited.openingFee).toBeUndefined();
    expect(edited.principal).toBe(11_000);
    // Given by its total: the total stays, the interest shrinks.
    expect(edited.totalToRepay).toBe(12_000);
    expect(edited.installmentAmount).toBe(2_000);
    expect(iso(edited.startDate!)).toBe('2027-01-10');

    await expect(
      loans.update(userId, debt.id, { principal: 13_000 }),
    ).rejects.toThrow(ValidationError);
  });

  it('links personal loans to contacts, created from the name when needed', async () => {
    const contacts = new ContactsService(prisma);
    const ana = await contacts.create(userId, '  Ana   López ');
    expect(ana.name).toBe('Ana López');
    expect((await contacts.create(userId, 'ana lópez')).id).toBe(ana.id);

    const byId = await loans.create(userId, {
      name: 'Préstamo de Ana',
      kind: DebtKind.loan,
      loanType: LoanType.personal,
      lenderContactId: ana.id,
      principal: 1_000,
    });
    expect(byId.lenderContactId).toBe(ana.id);
    expect(byId.lenderName).toBe('Ana López');

    const byName = await loans.create(userId, {
      name: 'Préstamo de Luis',
      kind: DebtKind.loan,
      loanType: LoanType.personal,
      lenderName: 'Luis',
      principal: 500,
    });
    const luis = (await contacts.findMany(userId)).find(
      (c) => c.name === 'Luis',
    );
    expect(byName.lenderContactId).toBe(luis?.id);

    // How each amount was lent, and an unknown loan date.
    const lent = await loans.addCharge(userId, {
      debtId: byId.id,
      date: d('2026-11-01'),
      description: 'Amazon',
      principal: 1_000,
      destination: DebtChargeDestination.purchase,
      lendingMethod: LendingMethod.credit_card,
    });
    expect(lent.charges[0].lendingMethod).toBe(LendingMethod.credit_card);
    expect(lent.remainingBalance).toBe(2_000);
    const dated = await loans.update(userId, byId.id, {
      startDate: d('2026-06-01'),
      lendingMethod: LendingMethod.cash,
    });
    expect(dated.lendingMethod).toBe(LendingMethod.cash);
    const undated = await loans.update(userId, byId.id, { startDate: null });
    expect(undated.startDate).toBeUndefined();

    const moved = await loans.update(userId, byName.id, {
      lenderContactId: ana.id,
    });
    expect(moved.lenderName).toBe('Ana López');
    const cleared = await loans.update(userId, byName.id, {
      lenderContactId: null,
    });
    expect(cleared.lenderContactId).toBeUndefined();
    expect(cleared.lenderName).toBeUndefined();

    await expect(
      loans.create(userId, {
        name: 'Banco con contacto',
        kind: DebtKind.loan,
        loanType: LoanType.institutional,
        lenderContactId: ana.id,
        principal: 1_000,
        interestMode: LoanInterestMode.total_amount,
        totalToRepay: 1_100,
        installmentsTotal: 2,
        paymentFrequency: RecurringFrequency.monthly,
        firstPaymentDate: d('2027-01-01'),
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('starts a personal loan at 0 and adds each amount later', async () => {
    const empty = await loans.create(userId, {
      name: 'Tarjeta de Pepe',
      kind: DebtKind.loan,
      loanType: LoanType.personal,
      lenderName: 'Pepe',
      principal: 0,
      destination: DebtChargeDestination.deposit,
    });
    expect(empty.status).toBe('active');
    expect(empty.remainingBalance).toBe(0);
    expect(empty.disbursementTransactionId).toBeUndefined();

    const lent = await loans.addCharge(userId, {
      debtId: empty.id,
      date: d('2026-11-01'),
      description: 'Amazon',
      principal: 1_000,
      destination: DebtChargeDestination.purchase,
      lendingMethod: LendingMethod.credit_card,
    });
    expect(lent.remainingBalance).toBe(1_000);

    const paid = await loans.recordPayment(userId, {
      debtId: empty.id,
      accountId: debitId,
      amount: 1_000,
      date: d('2026-11-02'),
    });
    expect(paid.status).toBe('paid_off');

    await expect(
      loans.create(userId, {
        name: 'Banco en cero',
        kind: DebtKind.loan,
        loanType: LoanType.institutional,
        principal: 0,
        interestMode: LoanInterestMode.total_amount,
        totalToRepay: 100,
        installmentsTotal: 1,
        paymentFrequency: RecurringFrequency.monthly,
        firstPaymentDate: d('2027-01-01'),
      }),
    ).rejects.toThrow('greater than 0');
  });

  it('files payments under Loans & Debts and keeps what the money was for', async () => {
    const owner = await prisma.user.create({
      data: { name: 'Categories', email: `loan-cats-${Date.now()}@test.local` },
    });
    await createDefaultCategories(prisma, owner.id);
    const categoryId = async (key: string) =>
      (
        await prisma.category.findFirstOrThrow({
          where: { userId: owner.id, key },
        })
      ).id;
    const loanPayments = await categoryId('categories.debts.loan_payments');
    const installmentPayments = await categoryId(
      'categories.debts.installment_payments',
    );
    const electronics = await categoryId('categories.shopping.electronics');
    const account = await prisma.account.create({
      data: {
        userId: owner.id,
        type: AccountType.debit,
        name: 'Débito',
        currency: 'MXN',
        balanceCurrent: 10_000,
      },
    });

    const kueski = await loans.create(owner.id, {
      name: 'Kueski celular',
      kind: DebtKind.loan,
      loanType: LoanType.purchase_financing,
      principal: 3_000,
      interestMode: LoanInterestMode.total_amount,
      totalToRepay: 3_600,
      installmentsTotal: 6,
      paymentFrequency: RecurringFrequency.biweekly,
      firstPaymentDate: d('2026-11-10'),
      paymentAccountId: account.id,
      purposeCategoryId: electronics,
    });
    expect(kueski.purposeCategoryId).toBe(electronics);
    const expense = await prisma.recurringExpense.findUniqueOrThrow({
      where: { debtId: kueski.id },
    });
    expect(expense.categoryId).toBe(installmentPayments);

    const withCharge = await loans.addCharge(owner.id, {
      debtId: kueski.id,
      date: d('2026-11-12'),
      principal: 500,
      installments: 2,
      destination: DebtChargeDestination.purchase,
      purposeCategoryId: electronics,
    });
    expect(withCharge.charges[0].purposeCategoryId).toBe(electronics);

    // An uncategorized bank movement confirmed as a payment takes the loan's.
    const movement = await prisma.transaction.create({
      data: {
        userId: owner.id,
        accountId: account.id,
        type: TransactionType.expense,
        amount: 600,
        currency: 'MXN',
        txnDate: d('2026-11-10'),
        description: 'KUESKI PAY',
        source: TransactionSource.imported,
      },
    });
    const occurrence = await prisma.recurringOccurrence.findFirstOrThrow({
      where: { recurringExpenseId: expense.id },
      orderBy: { dueDate: 'asc' },
    });
    await tracking.confirmPayment(owner.id, occurrence.id, movement.id);
    expect(
      (
        await prisma.transaction.findUniqueOrThrow({
          where: { id: movement.id },
        })
      ).categoryId,
    ).toBe(installmentPayments);

    const personal = await loans.create(owner.id, {
      name: 'Préstamo de Ana',
      kind: DebtKind.loan,
      loanType: LoanType.personal,
      lenderName: 'Ana',
      principal: 2_000,
    });
    await loans.recordPayment(owner.id, {
      debtId: personal.id,
      accountId: account.id,
      amount: 500,
      date: d('2026-11-01'),
    });
    const payment = await prisma.debtPayment.findFirstOrThrow({
      where: { debtId: personal.id },
      include: { transaction: true },
    });
    expect(payment.transaction?.categoryId).toBe(loanPayments);

    await expect(
      loans.create(owner.id, {
        name: 'Otro',
        kind: DebtKind.loan,
        loanType: LoanType.personal,
        principal: 100,
        purposeCategoryId: 'not-a-category',
      }),
    ).rejects.toThrow('Category not found');

    const cleared = await debts.update(personal.id, owner.id, {
      purposeCategoryId: electronics,
    });
    expect(cleared.purposeCategoryId).toBe(electronics);
    expect(
      (await debts.update(personal.id, owner.id, { purposeCategoryId: null }))
        .purposeCategoryId,
    ).toBeUndefined();
  });
});
