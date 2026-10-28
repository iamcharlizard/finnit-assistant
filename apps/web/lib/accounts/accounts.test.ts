import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { accountDesign, accountLabel } from '@/lib/finance/accounts';
import { toTransactionRow } from '@/lib/finance/transactions';
import type { ApiAccount, ApiTransaction } from '@/lib/finance/types';
import { testLocalizer } from '@/lib/i18n/testing';
import {
  CREATE_ACCOUNT_MUTATION,
  REMOVE_CREDIT_CARD_TERMS_MUTATION,
  SET_CREDIT_CARD_TERMS_MUTATION,
  UPDATE_ACCOUNT_MUTATION,
  accountErrorMessage,
  createManualAccount,
  isDuplicateNameError,
  saveAccountChanges,
  type GqlRunner,
} from './api';
import { OTHER_BANK, bankChoiceOf } from './banks';
import {
  buildCreateAccountInput,
  buildCreditTermsInput,
  buildMetadataPatch,
  buildTermsChange,
  deriveAccountName,
  designInputOf,
  editFormOf,
  emptyManualAccountForm,
  openingBalance,
  parseAmount,
  uniqueAccountName,
  validateEdit,
  validateWizard,
  validateWizardStep,
  type AccountEditValues,
  type ManualAccountForm,
} from './form';
import {
  buildAccountDetail,
  buildAccounts,
  groupAccounts,
  pickAccount,
} from './view';

const es = testLocalizer('es');
const en = testLocalizer('en');

const account = (overrides: Partial<ApiAccount>): ApiAccount => ({
  id: 'a',
  name: 'Cuenta',
  type: 'debit',
  currency: 'MXN',
  balanceCurrent: 0,
  archived: false,
  metadata: null,
  creditCardTerms: null,
  ...overrides,
});

const form = (overrides: Partial<ManualAccountForm>): ManualAccountForm => ({
  ...emptyManualAccountForm(),
  ...overrides,
});

describe('accountLabel and accountDesign', () => {
  it('prefers the nickname and falls back to the name', () => {
    assert.equal(accountLabel({ name: 'BBVA Oro' }), 'BBVA Oro');
    assert.equal(
      accountLabel({ name: 'BBVA Oro', metadata: { nickname: ' Súper ' } }),
      'Súper',
    );
    assert.equal(
      accountLabel({ name: 'BBVA Oro', metadata: { nickname: '  ' } }),
      'BBVA Oro',
    );
  });

  it('reads valid colors only', () => {
    assert.equal(accountDesign({ metadata: null }), null);
    assert.deepEqual(
      accountDesign({
        metadata: { design: { primaryColor: '#00696e', secondaryColor: 'x' } },
      }),
      { primaryColor: '#00696E', secondaryColor: null },
    );
    assert.equal(
      accountDesign({ metadata: { design: { primaryColor: 'red' } } }),
      null,
    );
  });

  it('shows the nickname on transaction rows', () => {
    const tx: ApiTransaction = {
      id: 't',
      type: 'expense',
      amount: 80,
      currency: 'MXN',
      txnDate: '2026-10-12T12:00:00.000Z',
      description: 'Café',
      merchantName: null,
      displayName: 'Café',
      isPrivate: false,
      isPending: false,
      source: 'manual',
      accountId: 'a',
      account: {
        id: 'a',
        name: 'BBVA Crédito •1234',
        type: 'credit',
        metadata: { nickname: 'La del súper' },
      },
      category: null,
    };
    const row = toTransactionRow(tx, new Map(), es);
    assert.match(row.time, /^La del súper/);
  });
});

describe('buildAccounts', () => {
  const accounts = buildAccounts(
    [
      account({
        id: 'cash',
        type: 'cash',
        name: 'Efectivo',
        balanceCurrent: 300,
      }),
      account({
        id: 'deb',
        balanceCurrent: 5400,
        metadata: {
          bank: 'BBVA',
          last4: '1234',
          creditLimit: null,
          nickname: 'Nómina',
          design: { primaryColor: '#5B61C2', secondaryColor: '#00696E' },
        },
      }),
      account({
        id: 'tdc',
        type: 'credit',
        name: 'Oro',
        balanceCurrent: -12450,
        creditCardTerms: {
          statementDay: 20,
          paymentDueDay: 10,
          interestRateAnnual: 45.5,
        },
      }),
      account({ id: 'sav', type: 'savings', name: 'Apartado' }),
      account({ id: 'old', name: 'Vieja', archived: true }),
    ],
    [
      {
        institution: 'Banamex',
        accounts: [
          {
            accountId: 'tdc',
            name: 'Oro',
            mask: '8824',
            creditLimit: 20000,
            availableCredit: 7550,
          },
        ],
      },
    ],
    es,
  );

  it('groups credit, then debit and cash, then savings, with bank data', () => {
    assert.deepEqual(
      accounts.map((c) => [
        c.id,
        c.tier,
        c.maskedNumber,
        c.bankName,
        c.balance,
        c.linked,
      ]),
      [
        [
          'tdc',
          'CRÉDITO',
          '•••• •••• •••• 8824',
          'Banamex',
          '$12,450.00',
          true,
        ],
        ['cash', 'EFECTIVO', '', null, '$300.00', false],
        ['deb', 'DÉBITO', '•••• •••• •••• 1234', 'BBVA', '$5,400.00', false],
        ['sav', 'AHORRO', '', null, '$0.00', false],
      ],
    );
    assert.deepEqual(accounts[0]!.credit, {
      owed: 12450,
      limit: 20000,
      available: '$7,550.00',
    });
    assert.equal(pickAccount(accounts, 'deb')?.id, 'deb');
    assert.equal(pickAccount(accounts, 'nope')?.id, 'tdc');
  });

  it('uses the nickname and the custom design', () => {
    const deb = accounts.find((a) => a.id === 'deb')!;
    assert.equal(deb.label, 'Nómina');
    assert.equal(deb.primaryColor, '#5B61C2');
    assert.equal(deb.secondaryColor, '#00696E');
    assert.deepEqual(deb.edit.design, {
      primaryColor: '#5B61C2',
      secondaryColor: '#00696E',
    });
  });

  it('hides archived accounts unless asked', () => {
    assert.ok(!accounts.some((a) => a.id === 'old'));
    const all = buildAccounts(
      [account({ id: 'old', archived: true })],
      [],
      es,
      {
        showArchived: true,
      },
    );
    assert.deepEqual(
      all.map((a) => [a.id, a.archived]),
      [['old', true]],
    );
  });

  it('names the sections in each language', () => {
    assert.deepEqual(
      groupAccounts(accounts, es.t).map((g) => [g.title, g.accounts.length]),
      [
        ['Tarjetas de crédito', 1],
        ['Débito y efectivo', 2],
        ['Ahorro y otras', 1],
      ],
    );
    assert.deepEqual(
      groupAccounts(accounts, en.t).map((g) => g.title),
      ['Credit cards', 'Debit & cash', 'Savings & other'],
    );
  });

  it('lists cut-off and payment dates, the rate and the recurring charges', () => {
    const detail = buildAccountDetail(
      accounts[0]!,
      {
        today: '2026-10-14',
        monthLabel: 'Octubre 2026',
        monthSpending: 3200,
        recent: [],
        summary: {
          recurringExpected: 398,
          recurringPaid: 199,
          recurringPayments: [{ name: 'Netflix' }, { name: 'Spotify' }],
          statement: null,
        },
      },
      es,
    );
    assert.deepEqual(detail.facts, [
      { label: 'Próximo corte', value: '20 oct · En 6 días' },
      { label: 'Próxima fecha de pago', value: '10 nov · En 27 días' },
      { label: 'Tasa anual', value: '45.5 %' },
    ]);
    assert.equal(detail.monthSpending, '$3,200.00');
    assert.deepEqual(detail.recurring, {
      expected: '$398.00',
      paid: '$199.00',
      count: 2,
    });
  });
});

describe('manual account wizard', () => {
  it('parses amounts as people type them', () => {
    assert.equal(parseAmount('12,345.678'), 12345.68);
    assert.equal(parseAmount('$ 1,000'), 1000);
    assert.equal(parseAmount('.5'), 0.5);
    assert.equal(parseAmount('abc'), null);
    assert.equal(parseAmount(''), null);
  });

  it('validates each step', () => {
    assert.deepEqual(validateWizardStep(form({}), 'type'), {
      type: 'required',
    });
    assert.deepEqual(
      validateWizardStep(form({ type: 'credit', last4: '12a4' }), 'details'),
      { bank: 'bankRequired', last4: 'last4' },
    );
    assert.deepEqual(
      validateWizardStep(
        form({ type: 'debit', bankChoice: OTHER_BANK, bankOther: ' ' }),
        'details',
      ),
      { bank: 'bankRequired' },
    );
    // Cash has no bank; savings may not have one.
    assert.deepEqual(validateWizardStep(form({ type: 'cash' }), 'details'), {});
    assert.deepEqual(
      validateWizardStep(form({ type: 'savings' }), 'details'),
      {},
    );
    assert.deepEqual(
      validateWizardStep(
        form({
          type: 'credit',
          debt: '-5',
          creditLimit: '0',
          statementDay: '32',
          paymentDueDay: '10',
          interestRate: '250',
        }),
        'money',
      ),
      {
        debt: 'notNegative',
        creditLimit: 'positive',
        statementDay: 'day',
        interestRate: 'rate',
      },
    );
    assert.deepEqual(
      validateWizardStep(form({ type: 'debit', balance: 'x' }), 'money'),
      { balance: 'amount' },
    );
    assert.deepEqual(
      validateWizardStep(
        form({
          design: { mode: 'gradient', primary: '#123456', secondary: '#12' },
        }),
        'design',
      ),
      { secondary: 'hex' },
    );
    assert.equal(
      validateWizard(form({ type: 'debit', bankChoice: 'BBVA', balance: '-1' }))
        .firstInvalidStep,
      'money',
    );
  });

  it('derives a unique account name', () => {
    const credit = form({ type: 'credit', bankChoice: 'BBVA', last4: '1234' });
    assert.equal(deriveAccountName(credit, 'Crédito'), 'BBVA Crédito •1234');
    assert.equal(
      deriveAccountName(
        form({
          type: 'debit',
          bankChoice: OTHER_BANK,
          bankOther: ' Caja Morelia ',
        }),
        'Débito',
      ),
      'Caja Morelia Débito',
    );
    assert.equal(
      deriveAccountName(
        form({ type: 'cash', bankChoice: 'BBVA', last4: '1234' }),
        'Efectivo',
      ),
      'Efectivo',
    );
    assert.equal(uniqueAccountName('Efectivo', ['Nu Ahorro']), 'Efectivo');
    assert.equal(
      uniqueAccountName('Efectivo', ['efectivo', 'Efectivo (2)']),
      'Efectivo (3)',
    );
  });

  it('records a credit debt as a negative opening balance', () => {
    assert.equal(
      openingBalance(form({ type: 'credit', debt: '12,450' })),
      -12450,
    );
    assert.equal(
      Object.is(openingBalance(form({ type: 'credit', debt: '' })), 0),
      true,
    );
    assert.equal(
      openingBalance(form({ type: 'debit', balance: '5400.5' })),
      5400.5,
    );
  });

  it('builds the createAccount and credit terms payloads', () => {
    const credit = form({
      type: 'credit',
      bankChoice: 'Nu',
      nickname: ' Morada ',
      last4: '4321',
      currency: 'MXN',
      debt: '1,500',
      creditLimit: '30000',
      statementDay: '5',
      paymentDueDay: '25',
      design: { mode: 'solid', primary: '#9500ca', secondary: '#00696E' },
    });
    assert.deepEqual(buildCreateAccountInput(credit, 'Nu Crédito •4321'), {
      type: 'credit',
      name: 'Nu Crédito •4321',
      currency: 'MXN',
      initialBalance: -1500,
      metadata: {
        bank: 'Nu',
        last4: '4321',
        nickname: 'Morada',
        design: { primaryColor: '#9500CA' },
        creditLimit: 30000,
      },
    });
    assert.deepEqual(buildCreditTermsInput(credit), {
      statementDay: 5,
      paymentDueDay: 25,
    });
    assert.deepEqual(
      buildCreditTermsInput({ ...credit, interestRate: '45.5' }),
      { statementDay: 5, paymentDueDay: 25, interestRateAnnual: 45.5 },
    );
    assert.deepEqual(
      buildCreateAccountInput(
        form({ type: 'cash', currency: 'USD', balance: '200', last4: '1111' }),
        'Efectivo',
      ),
      {
        type: 'cash',
        name: 'Efectivo',
        currency: 'USD',
        initialBalance: 200,
        metadata: {},
      },
    );
  });

  it('creates the account with the next free name, then its terms', async () => {
    const calls: [string, Record<string, unknown> | undefined][] = [];
    let failures = 1;
    const run: GqlRunner = async <T>(
      query: string,
      variables?: Record<string, unknown>,
    ) => {
      calls.push([query, variables]);
      if (query === CREATE_ACCOUNT_MUTATION && failures-- > 0) {
        throw new Error(
          'Unique constraint failed on the fields: (`userId`,`name`)',
        );
      }
      const input = variables?.input as { name?: string } | undefined;
      return { createAccount: { id: 'new', name: input?.name } } as T;
    };
    const created = await createManualAccount(
      form({
        type: 'credit',
        bankChoice: 'BBVA',
        creditLimit: '1000',
        statementDay: '1',
        paymentDueDay: '20',
      }),
      { baseName: 'BBVA Crédito', existingNames: ['BBVA Crédito'], run },
    );
    assert.deepEqual(created, {
      id: 'new',
      name: 'BBVA Crédito (3)',
      termsSaved: true,
    });
    assert.deepEqual(
      calls.map(([q, v]) => [
        q,
        (v?.input as { name?: string })?.name ?? v?.accountId,
      ]),
      [
        [CREATE_ACCOUNT_MUTATION, 'BBVA Crédito (2)'],
        [CREATE_ACCOUNT_MUTATION, 'BBVA Crédito (3)'],
        [SET_CREDIT_CARD_TERMS_MUTATION, 'new'],
      ],
    );
  });

  it('keeps the account when only the terms fail', async () => {
    const run: GqlRunner = async <T>(query: string) => {
      if (query === SET_CREDIT_CARD_TERMS_MUTATION) throw new Error('boom');
      return { createAccount: { id: 'new', name: 'X' } } as T;
    };
    const created = await createManualAccount(
      form({
        type: 'credit',
        bankChoice: 'BBVA',
        creditLimit: '1000',
        statementDay: '1',
        paymentDueDay: '20',
      }),
      { baseName: 'X', existingNames: [], run },
    );
    assert.equal(created.termsSaved, false);
  });

  it('turns API errors into the user language', () => {
    assert.ok(
      isDuplicateNameError({
        message: 'Unique constraint failed on the fields: (`userId`,`name`)',
      }),
    );
    assert.ok(!isDuplicateNameError({ message: 'Account not found' }));
    assert.equal(
      accountErrorMessage(
        { message: 'The nickname must be 1 to 40 characters' },
        es.t,
      ),
      'El apodo puede tener hasta 40 caracteres.',
    );
    assert.equal(
      accountErrorMessage({ message: 'Account not found' }, en.t),
      "We couldn't find this account.",
    );
  });
});

describe('edit account', () => {
  const initial: AccountEditValues = {
    type: 'credit',
    linked: false,
    archived: false,
    nickname: 'Morada',
    design: { primaryColor: '#9500CA', secondaryColor: null },
    bank: 'Caja Morelia',
    last4: '4321',
    creditLimit: 30000,
    terms: { statementDay: 5, paymentDueDay: 25, interestRateAnnual: null },
  };
  const start = editFormOf(initial, bankChoiceOf(initial.bank));

  it('starts from the stored values', () => {
    assert.equal(start.bankChoice, OTHER_BANK);
    assert.equal(start.bankOther, 'Caja Morelia');
    assert.equal(start.design.mode, 'solid');
    assert.equal(start.hasTerms, true);
    assert.equal(bankChoiceOf('bbva').choice, 'BBVA');
    assert.equal(buildMetadataPatch(start, initial), null);
    assert.equal(buildTermsChange(start, initial), null);
  });

  it('sends only what changed; empty fields remove', () => {
    assert.deepEqual(
      buildMetadataPatch(
        {
          ...start,
          nickname: ' ',
          design: {
            mode: 'gradient',
            primary: '#9500CA',
            secondary: '#00696e',
          },
          last4: '',
        },
        initial,
      ),
      {
        nickname: null,
        design: { primaryColor: '#9500CA', secondaryColor: '#00696E' },
        last4: null,
      },
    );
    assert.deepEqual(
      buildMetadataPatch(
        { ...start, design: { ...start.design, mode: 'preset' } },
        initial,
      ),
      { design: null },
    );
  });

  it('never changes bank fields of a linked account', () => {
    const linked = { ...initial, linked: true };
    assert.deepEqual(
      buildMetadataPatch(
        { ...start, bankChoice: 'BBVA', last4: '9999' },
        linked,
      ),
      null,
    );
    assert.deepEqual(validateEdit({ ...start, last4: 'abc' }, linked), {});
    assert.deepEqual(validateEdit({ ...start, last4: 'abc' }, initial), {
      last4: 'last4',
    });
  });

  it('sets, updates or removes the credit terms', () => {
    assert.deepEqual(
      buildTermsChange({ ...start, interestRate: '39.9' }, initial),
      {
        kind: 'set',
        input: { statementDay: 5, paymentDueDay: 25, interestRateAnnual: 39.9 },
      },
    );
    assert.deepEqual(buildTermsChange({ ...start, hasTerms: false }, initial), {
      kind: 'remove',
    });
    assert.equal(
      buildTermsChange(start, { ...initial, type: 'debit', terms: null }),
      null,
    );
  });

  it('saves metadata, then terms', async () => {
    const calls: string[] = [];
    const run: GqlRunner = async <T>(query: string) => {
      calls.push(query);
      return {} as T;
    };
    await saveAccountChanges(
      'a',
      { metadata: { nickname: 'X' }, terms: { kind: 'remove' } },
      run,
    );
    assert.deepEqual(calls, [
      UPDATE_ACCOUNT_MUTATION,
      REMOVE_CREDIT_CARD_TERMS_MUTATION,
    ]);
    assert.equal(
      designInputOf({
        mode: 'preset',
        primary: '#000000',
        secondary: '#000000',
      }),
      null,
    );
  });
});
