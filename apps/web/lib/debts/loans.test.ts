import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { testLocalizer } from '@/lib/i18n/testing';
import {
  asksFirstPayment,
  asksPaidInstallments,
  buildChargeInput,
  chargeFormOf,
  newChargeForm,
  validateChargeForm,
} from './charge-form';
import {
  buildCandidateRows,
  buildLoanDetailView,
  installmentsConcept,
  loanOutstanding,
} from './detail-view';
import {
  buildLoanInput,
  defaultPaymentCategoryId,
  depositMismatch,
  expectedDeposit,
  formOfDraft,
  loanPreview,
  newLoanForm,
  startsEmpty,
  validateLoanForm,
  withDefaultPaymentCategory,
  withLoanType,
  type LoanForm,
} from './loan-form';
import { previewLoanTerms } from './loan-terms';
import {
  destinationOfMethod,
  type ApiDebtDetail,
  type ApiLoanDraft,
  type ApiLoanScheduleItem,
} from './types';

const es = testLocalizer('es');
const today = '2026-10-30';

const institutional = (patch: Partial<LoanForm> = {}): LoanForm => ({
  ...newLoanForm('institutional'),
  name: 'YoTePresto',
  principal: '10000',
  installments: '12',
  rate: '12',
  includesVat: false,
  firstPaymentDate: '2026-11-15',
  destination: 'purchase',
  ...patch,
});

describe('previewLoanTerms', () => {
  it('matches the French amortization the API stores', () => {
    const terms = previewLoanTerms({
      mode: 'rate',
      principal: 10_000,
      installments: 12,
      frequency: 'monthly',
      annualRate: 12,
    })!;
    assert.equal(terms.installmentAmount, 888.49);
    assert.ok(Math.abs(terms.totalToRepay - 10_661.85) < 0.05);
    assert.equal(
      terms.interest,
      Math.round((terms.totalToRepay - 10_000) * 100) / 100,
    );
  });

  it('adds VAT on the interest and handles a zero rate', () => {
    const vat = previewLoanTerms({
      mode: 'rate',
      principal: 10_000,
      installments: 12,
      frequency: 'monthly',
      annualRate: 12,
      includesVat: true,
    })!;
    assert.ok(vat.installmentAmount > 888.49);
    assert.deepEqual(
      previewLoanTerms({
        mode: 'rate',
        principal: 1_200,
        installments: 12,
        frequency: 'monthly',
        annualRate: 0,
      }),
      { installmentAmount: 100, totalToRepay: 1_200, interest: 0, fees: 0 },
    );
  });

  it('derives the payment from the total, or the total from the payment', () => {
    assert.deepEqual(
      previewLoanTerms({
        mode: 'total_amount',
        principal: 10_000,
        installments: 12,
        frequency: 'monthly',
        totalToRepay: 12_000,
      }),
      {
        installmentAmount: 1_000,
        totalToRepay: 12_000,
        interest: 2_000,
        fees: 0,
      },
    );
    assert.deepEqual(
      previewLoanTerms({
        mode: 'installment_amount',
        principal: 10_000,
        installments: 24,
        frequency: 'semimonthly',
        installmentAmount: 500,
      }),
      {
        installmentAmount: 500,
        totalToRepay: 12_000,
        interest: 2_000,
        fees: 0,
      },
    );
  });

  it('waits for the values it needs', () => {
    assert.equal(
      previewLoanTerms({
        mode: 'rate',
        principal: 10_000,
        installments: 0,
        frequency: 'monthly',
        annualRate: 12,
      }),
      null,
    );
  });
});

describe('loan form', () => {
  it('validates a fixed-term loan', () => {
    assert.deepEqual(validateLoanForm(institutional(), { today }), {});
    assert.deepEqual(
      validateLoanForm(
        institutional({
          name: ' ',
          installments: '',
          rate: '2000',
          firstPaymentDate: '',
          installmentsPaid: '13',
          destination: 'deposit',
        }),
        { today },
      ),
      {
        name: 'nameRequired',
        installments: 'installmentsRequired',
        rate: 'rateInvalid',
        firstPaymentDate: 'firstPaymentRequired',
        depositAccountId: 'depositAccountRequired',
      },
    );
    assert.deepEqual(
      validateLoanForm(institutional({ installmentsPaid: '13' }), { today }),
      { installmentsPaid: 'paidTooMany' },
    );
    assert.deepEqual(
      validateLoanForm(
        institutional({ interestMode: 'total_amount', totalToRepay: '9000' }),
        { today },
      ),
      { totalToRepay: 'totalBelowPrincipal' },
    );
  });

  it('takes the opening fee from the deposit and blocks a deposit that does not add up', () => {
    const form = institutional({
      openingFee: '580',
      destination: 'deposit',
      depositAccountId: 'debit',
    });
    assert.equal(expectedDeposit(form), 9_420);
    assert.equal(depositMismatch(form), null);
    assert.equal(buildLoanInput(form).openingFee, 580);
    assert.deepEqual(validateLoanForm(form, { today }), {});

    // Edited to the same amount: fine. Anything else: blocked.
    const edited = { ...form, editDeposit: true, depositAmount: '9420' };
    assert.equal(depositMismatch(edited), null);
    const off = { ...edited, depositAmount: '9500' };
    assert.deepEqual(depositMismatch(off), { expected: 9_420, typed: 9_500 });
    assert.deepEqual(validateLoanForm(off, { today }), {
      openingFee: 'depositMismatch',
    });

    assert.deepEqual(
      validateLoanForm(institutional({ openingFee: '10000' }), { today }),
      { openingFee: 'openingFeeInvalid' },
    );
    // Only bank or lender loans have one.
    assert.equal(
      buildLoanInput({
        ...newLoanForm('personal'),
        ...form,
        loanType: 'personal',
      }).openingFee,
      undefined,
    );
  });

  it('refuses fewer payments made than the ones detected', () => {
    assert.deepEqual(
      validateLoanForm(institutional({ installmentsPaid: '2' }), {
        today,
        detectedPayments: 3,
      }),
      { installmentsPaid: 'paidBelowDetected' },
    );
  });

  it('builds the input of an institutional loan', () => {
    assert.deepEqual(
      buildLoanInput(
        institutional({
          lenderName: 'YoTePresto',
          includesVat: true,
          installmentsPaid: '4',
          destination: 'deposit',
          depositAccountId: 'debit',
          paymentAccountId: 'debit',
        }),
      ),
      {
        name: 'YoTePresto',
        kind: 'loan',
        loanType: 'institutional',
        principal: 10_000,
        destination: 'deposit',
        lenderName: 'YoTePresto',
        paymentAccountId: 'debit',
        depositAccountId: 'debit',
        depositCountsAsIncome: false,
        installmentsTotal: 12,
        interestMode: 'rate',
        interestRateAnnual: 12,
        includesVat: true,
        installmentsPaid: 4,
        paymentFrequency: 'monthly',
        firstPaymentDate: '2026-11-15',
      },
    );
  });

  it('builds a personal loan with past payments, counted or not', () => {
    const form: LoanForm = {
      ...newLoanForm('personal'),
      name: 'Mamá',
      principal: '5000',
      destination: 'purchase',
      historical: [
        { key: 'a', amount: '1000', date: '2026-09-01', accountId: '' },
        { key: 'b', amount: '500', date: '2026-10-01', accountId: 'debit' },
      ],
    };
    assert.deepEqual(validateLoanForm(form, { today }), {});
    const input = buildLoanInput(form);
    assert.equal(input.paymentFrequency, undefined);
    assert.deepEqual(input.historicalPayments, [
      { amount: 1_000, date: '2026-09-01' },
      { amount: 500, date: '2026-10-01', accountId: 'debit' },
    ]);
    assert.deepEqual(
      validateLoanForm(
        {
          ...form,
          historical: [
            { key: 'a', amount: '6000', date: '2026-09-01', accountId: '' },
          ],
        },
        { today },
      ),
      { historical: 'historicalTooMuch' },
    );
    assert.deepEqual(
      validateLoanForm(
        {
          ...form,
          historical: [
            { key: 'a', amount: '100', date: '2026-12-01', accountId: '' },
          ],
        },
        { today },
      ),
      { historical: 'historicalInvalid' },
    );
  });

  it('switches type defaults and previews personal totals', () => {
    const switched = withLoanType(institutional(), 'purchase_financing');
    assert.equal(switched.frequency, 'semimonthly');
    assert.equal(switched.destination, 'purchase');
    assert.equal(switched.name, 'YoTePresto');
    assert.deepEqual(
      loanPreview({
        ...newLoanForm('personal'),
        principal: '5000',
        totalToRepay: '5500',
      }),
      { installmentAmount: 0, totalToRepay: 5_500, interest: 500 },
    );
  });

  it('starts from a suggestion draft', () => {
    const draft: ApiLoanDraft = {
      fingerprint: 'fp',
      name: 'Préstamo Kubo',
      lenderName: 'Kubo Financiero',
      loanType: 'institutional',
      paymentFrequency: 'monthly',
      interval: 1,
      installmentAmount: 1_500,
      currency: 'MXN',
      firstPaymentDate: '2026-07-05T00:00:00.000Z',
      lastPaymentDate: '2026-10-05T00:00:00.000Z',
      paymentsDetected: 4,
      paymentAccountId: 'debit',
      categoryId: null,
      merchantPattern: 'KUBO FINANCIERO',
      classifiedBy: 'ai',
    };
    const form = formOfDraft(draft);
    assert.equal(form.interestMode, 'installment_amount');
    assert.equal(form.installmentAmount, '1500');
    assert.equal(form.firstPaymentDate, '2026-07-05');
    assert.equal(form.installmentsPaid, '4');
    assert.equal(form.paymentAccountId, 'debit');
  });
});

describe('charge form', () => {
  it('needs installments for a financed purchase', () => {
    const form = {
      ...newChargeForm({ loanType: 'purchase_financing' }, today),
      principal: '600',
    };
    assert.equal(form.destination, 'purchase');
    assert.deepEqual(
      validateChargeForm(form, { today, needsInstallments: true }),
      { installments: 'installmentsRequired' },
    );
    assert.deepEqual(
      buildChargeInput(
        { ...form, installments: '2', description: 'Audífonos' },
        'k',
      ),
      {
        debtId: 'k',
        date: today,
        principal: 600,
        destination: 'purchase',
        description: 'Audífonos',
        installments: 2,
      },
    );
  });

  it('deposits more money of a personal loan into an account', () => {
    const form = {
      ...newChargeForm({ loanType: 'personal' }, today),
      principal: '2000',
      totalToRepay: '2200',
    };
    assert.deepEqual(
      validateChargeForm(form, { today, needsInstallments: false }),
      { depositAccountId: 'depositAccountRequired' },
    );
    assert.deepEqual(
      buildChargeInput({ ...form, depositAccountId: 'debit' }, 'p'),
      {
        debtId: 'p',
        date: today,
        principal: 2_000,
        destination: 'deposit',
        totalToRepay: 2_200,
        depositAccountId: 'debit',
        depositCountsAsIncome: false,
      },
    );
  });
});

describe('personal loan in installments', () => {
  it('asks the first payment of amounts paid in their own installments', () => {
    const form = { installments: '3' };
    assert.equal(
      asksFirstPayment({ loanType: 'personal', installmentAmount: null }, form),
      true,
    );
    assert.equal(
      asksFirstPayment(
        { loanType: 'purchase_financing', installmentAmount: 325 },
        form,
      ),
      true,
    );
    // A personal loan with a fixed payment takes no installments.
    assert.equal(
      asksFirstPayment({ loanType: 'personal', installmentAmount: 500 }, form),
      false,
    );
    assert.equal(
      asksFirstPayment(
        { loanType: 'personal', installmentAmount: null },
        { installments: '' },
      ),
      false,
    );
  });

  it('sends the first payment after the date, and checks it', () => {
    const form = {
      ...newChargeForm({ loanType: 'personal' }, today),
      principal: '3000',
      installments: '3',
      destination: 'purchase' as const,
      firstPaymentDate: today,
    };
    // Same day is fine (bought on a due date); before it is not.
    assert.deepEqual(
      validateChargeForm(form, { today, needsInstallments: false }),
      {},
    );
    assert.deepEqual(
      validateChargeForm(
        { ...form, firstPaymentDate: '2026-10-01' },
        { today, needsInstallments: false },
      ),
      { firstPaymentDate: 'firstPaymentBeforeDate' },
    );
    const later = {
      ...form,
      date: '2026-10-01',
      firstPaymentDate: '2026-10-20',
    };
    assert.equal(buildChargeInput(later).firstPaymentDate, '2026-10-20');
    assert.equal(buildChargeInput(later).debtId, undefined);
  });

  it('edits a charge from what it saved', () => {
    const form = chargeFormOf({
      id: 'c',
      date: '2026-10-02T00:00:00.000Z',
      description: 'Pantalla',
      principal: 3_000,
      totalToRepay: 3_000,
      installments: 3,
      installmentsPaid: 0,
      firstPaymentDate: '2026-11-15T00:00:00.000Z',
      interestMode: 'rate',
      interestRateAnnual: 60,
      includesVat: true,
      destination: 'deposit',
      transactionId: 't',
      depositAccountId: 'debit',
      depositCountsAsIncome: false,
      purposeCategoryId: null,
      lendingMethod: 'credit_card',
    });
    assert.equal(form.date, '2026-10-02');
    assert.equal(form.firstPaymentDate, '2026-11-15');
    assert.equal(form.interest, 'rate');
    assert.equal(form.rate, '60');
    assert.equal(form.includesVat, true);
    assert.equal(form.totalToRepay, '');
    assert.equal(form.installments, '3');
    assert.equal(form.depositAccountId, 'debit');
  });

  it('takes the installments already paid of a purchase', () => {
    const form = {
      ...newChargeForm({ loanType: 'purchase_financing' }, today),
      principal: '3628.48',
      installments: '4',
      installmentsPaid: '5',
    };
    assert.equal(
      asksPaidInstallments(
        { loanType: 'purchase_financing', installmentAmount: 900 },
        form,
      ),
      true,
    );
    assert.equal(
      asksPaidInstallments(
        { loanType: 'personal', installmentAmount: 500 },
        form,
      ),
      false,
    );
    assert.deepEqual(
      validateChargeForm(form, { today, needsInstallments: true }),
      { installmentsPaid: 'installmentsPaidInvalid' },
    );
    assert.equal(
      buildChargeInput({ ...form, installmentsPaid: '2' }, 'k')
        .installmentsPaid,
      2,
    );
    assert.equal(
      buildChargeInput({ ...form, installmentsPaid: '' }, 'k').installmentsPaid,
      undefined,
    );
  });

  it('names each installment of a payment', () => {
    assert.equal(
      installmentsConcept([
        { number: 1, of: 3, amount: 1_000, description: 'Pantalla' },
        { number: 2, of: 12, amount: 50, description: null },
      ]),
      'Pantalla 01/03 · 02/12',
    );
    assert.equal(installmentsConcept(null), null);
  });
});

describe('personal loan lender', () => {
  it('sends the contact, or the typed name when there is none', () => {
    const base = {
      ...newLoanForm('personal'),
      name: 'Préstamo de Ana',
      principal: '1000',
    };
    const withContact = buildLoanInput({
      ...base,
      lenderContactId: 'ana',
      lenderName: 'Ana',
    });
    assert.equal(withContact.lenderContactId, 'ana');
    assert.equal(withContact.lenderName, undefined);
    const typed = buildLoanInput({ ...base, lenderName: 'Luis' });
    assert.equal(typed.lenderName, 'Luis');
    assert.equal(typed.lenderContactId, undefined);
    // Bank loans keep a plain name.
    assert.equal(
      buildLoanInput({
        ...withLoanType(base, 'institutional'),
        lenderContactId: 'ana',
        lenderName: 'YoTePresto',
      }).lenderContactId,
      undefined,
    );
  });
});

describe('personal loan started at 0', () => {
  it('needs no amount, deposit or method', () => {
    const form = {
      ...newLoanForm('personal'),
      name: 'Tarjeta de Pepe',
      destination: 'deposit' as const,
      lendingMethod: 'cash' as const,
    };
    assert.equal(startsEmpty(form), true);
    assert.deepEqual(validateLoanForm(form, { today }), {});
    const input = buildLoanInput(form);
    assert.equal(input.principal, 0);
    assert.equal(input.destination, undefined);
    assert.equal(input.lendingMethod, undefined);
    assert.equal(startsEmpty({ ...form, principal: '500' }), false);
    assert.equal(
      validateLoanForm(
        { ...newLoanForm('institutional'), name: 'Banco' },
        { today },
      ).principal,
      'principalRequired',
    );
  });
});

describe('lending method', () => {
  it('is sent for personal loans and their added amounts', () => {
    const form = {
      ...newLoanForm('personal'),
      name: 'Préstamo de Ana',
      principal: '1000',
      lendingMethod: 'transfer' as const,
    };
    assert.equal(buildLoanInput(form).lendingMethod, 'transfer');
    assert.equal(destinationOfMethod('credit_card'), 'purchase');
    assert.equal(destinationOfMethod('cash'), 'deposit');
    const charge = {
      ...newChargeForm({ loanType: 'personal' }, today),
      principal: '1000',
      destination: 'purchase' as const,
      lendingMethod: 'credit_card' as const,
    };
    assert.equal(buildChargeInput(charge, 'p').lendingMethod, 'credit_card');
  });
});

describe('fee per payment', () => {
  // YoTePresto: $200,000 at 18.9% + VAT, 24 months, $257.76 + VAT a month.
  const form = (patch: Partial<LoanForm> = {}): LoanForm => ({
    ...newLoanForm('institutional'),
    name: 'YoTePresto',
    principal: '200000',
    installments: '24',
    rate: '18.9',
    includesVat: true,
    periodicFee: '257.76',
    periodicFeeAddVat: true,
    ...patch,
  });

  it('adds the fee (with VAT) to every payment, apart from the interest', () => {
    const preview = loanPreview(form());
    assert.equal(preview?.installmentAmount, 10_667.13);
    assert.equal(preview?.fees, 7_176);
    assert.equal(
      loanPreview(form({ periodicFee: '' }))?.installmentAmount,
      10_368.13,
    );
    assert.equal(buildLoanInput(form()).periodicFee, 299);
  });

  it('only applies to bank loans given by their rate', () => {
    assert.equal(
      buildLoanInput(
        form({ interestMode: 'total_amount', totalToRepay: '250000' }),
      ).periodicFee,
      undefined,
    );
    assert.equal(
      buildLoanInput(withLoanType(form(), 'purchase_financing')).periodicFee,
      undefined,
    );
  });
});

describe('loan categories', () => {
  const categories = [
    { id: 'loans', key: 'categories.debts.loan_payments' },
    { id: 'plazos', key: 'categories.debts.installment_payments' },
    { id: 'food', key: 'categories.food' },
  ];

  it('picks Loan Payments, or Installment Payments for purchase financing', () => {
    assert.equal(defaultPaymentCategoryId(categories, 'personal'), 'loans');
    assert.equal(
      defaultPaymentCategoryId(categories, 'purchase_financing'),
      'plazos',
    );
    assert.equal(defaultPaymentCategoryId([], 'institutional'), '');
  });

  it('fills the default and follows the type until the user picks another', () => {
    const form = withDefaultPaymentCategory(newLoanForm(), categories);
    assert.equal(form.categoryId, 'loans');
    const purchase = withDefaultPaymentCategory(
      withLoanType(form, 'purchase_financing'),
      categories,
      'institutional',
    );
    assert.equal(purchase.categoryId, 'plazos');
    const chosen = withDefaultPaymentCategory(
      withLoanType({ ...form, categoryId: 'food' }, 'purchase_financing'),
      categories,
      'institutional',
    );
    assert.equal(chosen.categoryId, 'food');
  });

  it('sends what the money was for', () => {
    const form = { ...newLoanForm('personal'), purposeCategoryId: 'food' };
    assert.equal(buildLoanInput(form).purposeCategoryId, 'food');
    assert.equal(
      buildLoanInput(newLoanForm('personal')).purposeCategoryId,
      undefined,
    );
  });
});

describe('loan detail view', () => {
  const debt: ApiDebtDetail = {
    id: 'loan',
    name: 'YoTePresto',
    description: null,
    kind: 'loan',
    principal: 10_000,
    interestRateAnnual: 12,
    minPaymentAmount: 888.49,
    startDate: '2026-05-15T00:00:00.000Z',
    dueDate: '2027-04-15T00:00:00.000Z',
    linkedAccountId: null,
    loanType: 'institutional',
    status: 'active',
    lenderName: 'YoTePresto',
    lenderContactId: null,
    lendingMethod: null,
    paymentFrequency: 'monthly',
    installmentsTotal: 12,
    installmentsPaid: 2,
    installmentAmount: 888.49,
    totalToRepay: 10_661.85,
    interestMode: 'rate',
    includesVat: false,
    openingFee: 300,
    periodicFee: null,
    destination: 'deposit',
    purposeCategoryId: null,
    nextPaymentDate: '2026-10-15T00:00:00.000Z',
    recurringExpenseId: 'rec',
    remainingBalance: 8_884.87,
    totalPaid: 1_776.98,
    historicalPaid: 888.49,
    totalOwed: 10_661.85,
    monthlyPayment: 888.49,
    createdAt: '2026-10-01T00:00:00.000Z',
    payments: [],
    charges: [],
  };
  const item = (
    dueDate: string,
    patch: Partial<ApiLoanScheduleItem> = {},
  ): ApiLoanScheduleItem => ({
    dueDate: `${dueDate}T00:00:00.000Z`,
    amount: 888.49,
    status: 'upcoming',
    occurrenceId: `occ-${dueDate}`,
    transactionId: null,
    isHistorical: false,
    projected: false,
    principal: null,
    interest: null,
    vat: null,
    fee: null,
    installments: null,
    originalDueDate: null,
    balance: 0,
    ...patch,
  });

  it('names what the loan and each charge were for', () => {
    const view = buildLoanDetailView(
      {
        ...debt,
        purposeCategoryId: 'tech',
        charges: [
          {
            id: 'c1',
            date: '2026-10-02T00:00:00.000Z',
            description: null,
            principal: 600,
            totalToRepay: 600,
            installments: 2,
            installmentsPaid: 0,
            firstPaymentDate: null,
            interestMode: null,
            interestRateAnnual: null,
            includesVat: false,
            destination: 'purchase',
            transactionId: null,
            depositAccountId: null,
            depositCountsAsIncome: null,
            purposeCategoryId: 'tech',
            lendingMethod: null,
          },
        ],
      },
      [],
      {
        today,
        categories: [
          { id: 'tech', name: 'Electrónica', parentId: 'shop', key: null },
        ],
      },
      es,
    );
    assert.equal(view.purpose, 'Electrónica');
    assert.equal(view.charges[0]?.purpose, 'Electrónica');
    assert.equal(buildLoanDetailView(debt, [], { today }, es).purpose, null);
  });

  it('shows the schedule date of a moved payment', () => {
    const view = buildLoanDetailView(
      debt,
      [
        item('2026-11-12', { originalDueDate: '2026-11-15T00:00:00.000Z' }),
        item('2026-11-30'),
      ],
      { today },
      es,
    );
    assert.equal(view.schedule[0]!.dateLabel, '12 de noviembre de 2026');
    assert.equal(
      view.schedule[0]!.originalDateLabel,
      '15 de noviembre de 2026',
    );
    assert.equal(view.schedule[0]!.occurrenceId, 'occ-2026-11-12');
    assert.equal(view.schedule[1]!.originalDateLabel, null);
  });

  it('splits what is left from the amortization table', () => {
    const money = (n: number) => String(n);
    const open = (principal: number, interest: number, vat: number) =>
      item('2026-11-26', {
        amount: principal + interest + vat + 299,
        principal,
        interest,
        vat,
        fee: 299,
      });
    const rows = [
      item('2026-10-26', { status: 'paid', principal: 7_000, interest: 1 }),
      open(9_000, 1_000, 160),
      open(9_500, 500, 80),
    ];
    const left = loanOutstanding(
      { ...debt, remainingBalance: 20_838 },
      rows,
      money,
    );
    assert.equal(left.payoff, 18_500);
    assert.equal(left.estimated, false);
    assert.deepEqual(
      left.parts.map((p) => [p.key, p.amount]),
      [
        ['principal', 18_500],
        ['interest', 1_500],
        ['vat', 240],
        ['fees', 598],
      ],
    );
    assert.equal(left.savingLabel, '2338');
  });

  it('estimates what is left in proportion without a table', () => {
    const left = loanOutstanding(
      {
        ...debt,
        principal: 10_000,
        totalOwed: 12_000,
        remainingBalance: 6_000,
        charges: [],
      },
      [item('2026-11-15')],
      String,
    );
    assert.equal(left.payoff, 5_000);
    assert.equal(left.estimated, true);
    assert.deepEqual(
      left.parts.map((p) => p.key),
      ['principal', 'interest'],
    );
  });

  it('lists the first amount and every one added, with how it was lent', () => {
    const view = buildLoanDetailView(
      {
        ...debt,
        loanType: 'personal',
        startDate: null,
        totalToRepay: null,
        lendingMethod: 'cash',
        charges: [
          {
            id: 'amazon',
            date: '2026-11-01T00:00:00.000Z',
            description: 'Amazon',
            principal: 1_000,
            totalToRepay: 1_000,
            installments: null,
            installmentsPaid: 0,
            firstPaymentDate: null,
            interestMode: null,
            interestRateAnnual: null,
            includesVat: false,
            destination: 'purchase',
            transactionId: null,
            depositAccountId: null,
            depositCountsAsIncome: null,
            purposeCategoryId: null,
            lendingMethod: 'credit_card',
          },
        ],
      },
      [],
      { today },
      es,
    );
    assert.equal(
      buildLoanDetailView(
        { ...debt, loanType: 'personal', principal: 0, charges: [] },
        [],
        { today },
        es,
      ).lent.length,
      0,
    );
    assert.deepEqual(
      view.lent.map((row) => [
        row.chargeId,
        row.dateLabel,
        row.description,
        row.method,
        row.amount,
      ]),
      [
        [
          'amazon',
          '1 de noviembre de 2026',
          'Amazon',
          'Su tarjeta de crédito',
          '$1,000.00',
        ],
        [null, 'Sin fecha', 'Préstamo inicial', 'Efectivo', '$10,000.00'],
      ],
    );
  });

  it('splits each payment for the amortization table', () => {
    const view = buildLoanDetailView(
      debt,
      [
        item('2026-11-15', {
          amount: 10_667.13,
          principal: 6_714.13,
          interest: 3_150,
          vat: 504,
          fee: 299,
          balance: 193_285.87,
        }),
      ],
      { today },
      es,
    );
    assert.equal(view.hasBreakdown, true);
    assert.equal(view.hasFees, true);
    assert.equal(view.schedule[0]?.interestLabel, '$3,150.00');
    assert.equal(view.schedule[0]?.balanceLabel, '$193,285.87');
    assert.equal(view.schedule[0]?.dateLabel, '15 de noviembre de 2026');
    assert.equal(view.schedule[0]?.number, 1);
    assert.equal(view.schedule[0]?.dueDate, '2026-11-15');
    assert.equal(
      buildLoanDetailView(debt, [item('2026-11-15')], { today }, es)
        .hasBreakdown,
      false,
    );
    assert.deepEqual(
      view.facts.map((fact) => fact.key),
      [
        'name',
        'lender',
        'type',
        'principal',
        'installments',
        'frequency',
        'rate',
        'payment',
        'total',
        'startDate',
        'openingFee',
        'purpose',
      ],
    );
  });

  it('labels every payment of the schedule and finds the next one', () => {
    const view = buildLoanDetailView(
      debt,
      [
        item('2026-08-15', {
          status: 'paid',
          isHistorical: true,
          occurrenceId: null,
        }),
        item('2026-09-15', { status: 'paid', transactionId: 't' }),
        item('2026-10-15'),
        item('2026-11-15'),
        item('2027-03-15', { projected: true, occurrenceId: null }),
      ],
      { today },
      es,
    );
    assert.deepEqual(
      view.schedule.map((r) => [r.status, Boolean(r.occurrenceId)]),
      [
        ['historical', false],
        ['paid', false],
        ['overdue', true],
        ['upcoming', true],
        ['projected', false],
      ],
    );
    assert.equal(view.next?.overdue, true);
    assert.equal(view.paidCount, 2);
    assert.equal(view.interest, '$661.85');
    assert.equal(view.termsLabel, '12 pagos mensuales de $888.49');
    assert.equal(view.paidPercent, 17);
    assert.equal(
      view.openingFeeLabel,
      'Comisión por apertura $300.00 (recibiste $9,700.00)',
    );
  });

  it('formats payment candidates', () => {
    const [row] = buildCandidateRows(
      [
        {
          occurrenceId: 'occ',
          dueDate: '2026-10-15T00:00:00.000Z',
          expectedAmount: 888.49,
          transactionId: 't',
          date: '2026-10-16T00:00:00.000Z',
          amount: 888.49,
          description: 'PAGO YOTEPRESTO',
          accountName: 'Nómina',
          reason: 'text',
          score: 0.9,
        },
      ],
      today,
      es,
    );
    assert.equal(row!.key, 'occ:t');
    assert.equal(row!.amountLabel, '$888.49');
    assert.equal(row!.reason, 'text');
  });
});
