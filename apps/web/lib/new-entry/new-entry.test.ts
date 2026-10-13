import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { GraphqlRequestError, NETWORK_ERROR } from '@/lib/graphql/client';
import { testLocalizer } from '@/lib/i18n/testing';
import { duplicateCheck, planForDuplicateAnswer } from './duplicates';
import { createErrorKey, uploadErrorKey } from './errors';
import {
  applySuggestedCategory,
  buildTransactionInput,
  buildTransferInput,
  currencyOf,
  emptyEntryDraft,
  emptyTransferDraft,
  hasErrors,
  merchantQuery,
  parseAmount,
  similarTransactionsArgs,
  validateEntry,
  validateTransfer,
  type EntryDraft,
} from './form';
import type {
  EntryAccount,
  EntryCategory,
  SimilarTransaction,
} from './graphql';
import {
  accountOptionLabel,
  accountOptions,
  categoryOptions,
  isCardPayment,
  transferSources,
  transferTargets,
} from './options';
import { attachmentUploadUrl } from './upload';

const TODAY = '2026-10-13';

function account(overrides: Partial<EntryAccount> = {}): EntryAccount {
  return {
    id: 'acc-debit',
    name: 'Nómina BBVA',
    type: 'debit',
    currency: 'MXN',
    balanceCurrent: 5000,
    archived: false,
    metadata: null,
    ...overrides,
  };
}

const debit = account();
const cash = account({ id: 'acc-cash', name: 'Efectivo', type: 'cash' });
const card = account({
  id: 'acc-card',
  name: 'TDC Oro',
  type: 'credit',
  balanceCurrent: -1200,
  metadata: { nickname: 'La dorada', last4: '4321' },
});
const usd = account({ id: 'acc-usd', name: 'Dólares', currency: 'USD' });
const archived = account({ id: 'acc-old', name: 'Vieja', archived: true });
const ACCOUNTS = [debit, cash, card, usd, archived];

function draft(overrides: Partial<EntryDraft> = {}): EntryDraft {
  return {
    ...emptyEntryDraft('expense', TODAY),
    amount: '150.50',
    accountId: 'acc-debit',
    ...overrides,
  };
}

describe('parseAmount', () => {
  it('reads amounts as written in Mexico', () => {
    assert.equal(parseAmount('150.50'), 150.5);
    assert.equal(parseAmount('$1,234.56'), 1234.56);
    assert.equal(parseAmount(' 80 '), 80);
    assert.equal(parseAmount('.5'), 0.5);
    assert.equal(parseAmount('10.'), 10);
    assert.equal(parseAmount('99.999'), 100);
  });

  it('rejects what is not a number', () => {
    for (const text of ['', 'abc', '1.2.3', '-5', '12a', '1e5']) {
      assert.equal(parseAmount(text), null, text);
    }
  });
});

describe('validateEntry', () => {
  it('accepts a complete draft', () => {
    assert.deepEqual(validateEntry(draft(), TODAY), {});
    assert.equal(hasErrors(validateEntry(draft(), TODAY)), false);
  });

  it('requires a positive amount, an account and a date up to today', () => {
    assert.deepEqual(
      validateEntry(
        draft({ amount: '', accountId: undefined, date: undefined }),
        TODAY,
      ),
      {
        amount: 'amountRequired',
        accountId: 'accountRequired',
        date: 'dateRequired',
      },
    );
    assert.equal(
      validateEntry(draft({ amount: '0' }), TODAY).amount,
      'amountInvalid',
    );
    assert.equal(
      validateEntry(draft({ amount: 'x' }), TODAY).amount,
      'amountInvalid',
    );
    assert.equal(
      validateEntry(draft({ amount: '1000000000' }), TODAY).amount,
      'amountTooLarge',
    );
    assert.equal(
      validateEntry(draft({ date: '2026-10-14' }), TODAY).date,
      'dateInFuture',
    );
    assert.equal(
      validateEntry(draft({ date: '2026-02-30' }), TODAY).date,
      'dateRequired',
    );
  });
});

describe('buildTransactionInput', () => {
  it('sends a date-only day, the account currency and trimmed texts', () => {
    const input = buildTransactionInput(
      draft({
        type: 'income',
        amount: '$2,500',
        date: '2026-10-01',
        merchant: '  Nómina ',
        note: ' ',
        categoryId: 'cat-salary',
      }),
      usd,
    );
    assert.deepEqual(input, {
      accountId: 'acc-usd',
      type: 'income',
      amount: 2500,
      currency: 'USD',
      txnDate: '2026-10-01',
      merchantName: 'Nómina',
      description: null,
      categoryId: 'cat-salary',
    });
    assert.match(input.txnDate, /^\d{4}-\d{2}-\d{2}$/);
  });

  it('leaves the category empty so the API can suggest one', () => {
    assert.equal(buildTransactionInput(draft(), debit).categoryId, null);
  });

  it('asks for look-alikes of the same account, amount, day and type', () => {
    const input = buildTransactionInput(draft({ date: '2026-10-12' }), debit);
    assert.deepEqual(similarTransactionsArgs(input), {
      accountId: 'acc-debit',
      amount: 150.5,
      date: '2026-10-12',
      type: 'expense',
    });
  });
});

describe('currencyOf', () => {
  it('uses the account currency, MXN by default', () => {
    assert.equal(currencyOf(ACCOUNTS, 'acc-usd'), 'USD');
    assert.equal(currencyOf(ACCOUNTS, undefined), 'MXN');
  });
});

describe('transfers', () => {
  const valid = {
    ...emptyTransferDraft(TODAY),
    amount: '500',
    fromAccountId: 'acc-debit',
    toAccountId: 'acc-card',
  };

  it('validates both accounts', () => {
    assert.deepEqual(validateTransfer(valid, ACCOUNTS, TODAY), {});
    assert.deepEqual(
      validateTransfer(emptyTransferDraft(TODAY), ACCOUNTS, TODAY),
      {
        amount: 'amountRequired',
        fromAccountId: 'fromRequired',
        toAccountId: 'toRequired',
      },
    );
    assert.equal(
      validateTransfer({ ...valid, toAccountId: 'acc-debit' }, ACCOUNTS, TODAY)
        .toAccountId,
      'sameAccount',
    );
    assert.equal(
      validateTransfer({ ...valid, toAccountId: 'acc-usd' }, ACCOUNTS, TODAY)
        .toAccountId,
      'currencyMismatch',
    );
  });

  it('builds the input with a localized default description', () => {
    assert.deepEqual(buildTransferInput(valid, 'Pago de tarjeta La dorada'), {
      fromAccountId: 'acc-debit',
      toAccountId: 'acc-card',
      amount: 500,
      txnDate: TODAY,
      description: 'Pago de tarjeta La dorada',
    });
    assert.equal(
      buildTransferInput({ ...valid, description: ' Ahorro ' }, 'x')
        .description,
      'Ahorro',
    );
  });

  it('leaves credit cards out of the sources and keeps the currency', () => {
    assert.deepEqual(
      transferSources(ACCOUNTS).map((o) => o.value),
      ['acc-debit', 'acc-cash', 'acc-usd'],
    );
    assert.deepEqual(
      transferTargets(ACCOUNTS, 'acc-debit').map((o) => o.value),
      ['acc-cash', 'acc-card'],
    );
    assert.deepEqual(
      transferTargets(ACCOUNTS, 'acc-usd').map((o) => o.value),
      [],
    );
  });

  it('calls a transfer into a credit card a card payment', () => {
    assert.equal(isCardPayment(ACCOUNTS, 'acc-card'), true);
    assert.equal(isCardPayment(ACCOUNTS, 'acc-cash'), false);
    assert.equal(isCardPayment(ACCOUNTS, undefined), false);
  });
});

describe('account options', () => {
  it('shows the nickname and last digits, never archived accounts', () => {
    assert.equal(accountOptionLabel(card), 'La dorada · 4321');
    assert.equal(accountOptionLabel(debit), 'Nómina BBVA');
    const options = accountOptions(ACCOUNTS);
    assert.equal(options.length, 4);
    assert.ok(options[2]!.keywords!.includes('TDC Oro'));
  });
});

describe('categoryOptions', () => {
  const categories: EntryCategory[] = [
    { id: 'food', name: 'Comida', parentId: null, key: 'categories.food' },
    { id: 'super', name: 'Supermercado', parentId: 'food', key: null },
    { id: 'cafe', name: 'Café', parentId: 'food', key: null },
    { id: 'inc', name: 'Ingresos', parentId: null, key: 'categories.income' },
    { id: 'salary', name: 'Salario', parentId: 'inc', key: null },
    { id: 'bills', name: 'Servicios', parentId: null, key: 'categories.bills' },
  ];

  it('groups subcategories under their parent, income last for expenses', () => {
    const options = categoryOptions(categories, 'expense', 'es');
    assert.deepEqual(
      options.map((o) => [o.value, o.group]),
      [
        ['food', 'Comida'],
        ['cafe', 'Comida'],
        ['super', 'Comida'],
        ['bills', 'Servicios'],
        ['inc', 'Ingresos'],
        ['salary', 'Ingresos'],
      ],
    );
    assert.deepEqual(options[1]!.keywords, ['Comida']);
  });

  it('puts income first for an ingreso', () => {
    const options = categoryOptions(categories, 'income', 'es');
    assert.deepEqual(
      options.slice(0, 2).map((o) => o.value),
      ['inc', 'salary'],
    );
  });
});

describe('category suggestion', () => {
  it('preselects the suggestion unless the user picked one', () => {
    const base = draft();
    const suggested = applySuggestedCategory(base, 'cat-food');
    assert.equal(suggested.categoryId, 'cat-food');
    assert.equal(applySuggestedCategory(suggested, 'cat-food'), suggested);
    assert.equal(applySuggestedCategory(base, null), base);
    const picked = draft({ categoryId: 'cat-mine', categoryPicked: true });
    assert.equal(applySuggestedCategory(picked, 'cat-food'), picked);
    const cleared = draft({ categoryId: undefined, categoryPicked: true });
    assert.equal(applySuggestedCategory(cleared, 'cat-food'), cleared);
  });

  it('only asks for merchants with 3+ characters', () => {
    assert.equal(merchantQuery(' Ox '), null);
    assert.equal(merchantQuery(' Oxxo '), 'Oxxo');
  });
});

describe('duplicates', () => {
  const match: SimilarTransaction = {
    id: 'tx-1',
    type: 'expense',
    amount: 150.5,
    currency: 'MXN',
    txnDate: '2026-10-12T00:00:00.000Z',
    description: null,
    merchantName: 'Oxxo',
  };

  it('asks only when there are look-alikes', () => {
    assert.deepEqual(duplicateCheck([]), { kind: 'create' });
    assert.deepEqual(duplicateCheck(null), { kind: 'create' });
    assert.deepEqual(duplicateCheck([match]), {
      kind: 'ask',
      matches: [match],
    });
  });

  it('attaches the receipt to the chosen one, or just closes', () => {
    const isThis = { kind: 'isThis' as const, transactionId: 'tx-1' };
    assert.deepEqual(planForDuplicateAnswer(isThis, true), {
      kind: 'attachToExisting',
      transactionId: 'tx-1',
    });
    assert.deepEqual(planForDuplicateAnswer(isThis, false), { kind: 'close' });
    assert.deepEqual(planForDuplicateAnswer({ kind: 'createAnyway' }, true), {
      kind: 'create',
    });
  });
});

describe('errors', () => {
  it('maps API errors to friendly messages', () => {
    const err = (code: string, message = 'x') =>
      new GraphqlRequestError(message, code, true);
    assert.equal(
      createErrorKey(err('INSUFFICIENT_BALANCE')),
      'insufficientBalance',
    );
    assert.equal(createErrorKey(err('TRANSFER_SAME_ACCOUNT')), 'sameAccount');
    assert.equal(createErrorKey(err('NOT_FOUND')), 'notFound');
    assert.equal(
      createErrorKey(
        err('VALIDATION_ERROR', 'Currency conversion not supported yet'),
      ),
      'currencyMismatch',
    );
    assert.equal(createErrorKey(err('BAD_USER_INPUT')), 'invalid');
    assert.equal(createErrorKey(err(NETWORK_ERROR)), 'network');
    assert.equal(createErrorKey(err('UNAUTHENTICATED')), 'sessionEnded');
    assert.equal(createErrorKey(err('INTERNAL_SERVER_ERROR')), 'createFailed');
    assert.equal(createErrorKey(new Error('boom')), 'createFailed');
  });

  it('maps upload statuses', () => {
    assert.equal(uploadErrorKey(0), 'uploadNetwork');
    assert.equal(uploadErrorKey(413), 'uploadTooLarge');
    assert.equal(uploadErrorKey(400), 'uploadInvalid');
    assert.equal(uploadErrorKey(502), 'uploadFailed');
  });

  it('has a message for every key in both languages', () => {
    const keys = [
      'network',
      'sessionEnded',
      'insufficientBalance',
      'sameAccount',
      'currencyMismatch',
      'notFound',
      'invalid',
      'createFailed',
      'uploadNetwork',
      'uploadTooLarge',
      'uploadInvalid',
      'uploadFailed',
    ] as const;
    for (const locale of ['es', 'en'] as const) {
      const { t } = testLocalizer(locale);
      for (const key of keys) {
        assert.notEqual(t(`newEntry.errors.${key}`), `newEntry.errors.${key}`);
      }
    }
  });
});

describe('attachmentUploadUrl', () => {
  it('goes through the file proxy', () => {
    assert.equal(
      attachmentUploadUrl('6f1c1f2e-0000-4000-8000-000000000001'),
      '/api/files/transactions/6f1c1f2e-0000-4000-8000-000000000001/attachments',
    );
  });
});
