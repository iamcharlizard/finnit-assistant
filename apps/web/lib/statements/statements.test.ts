import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { GraphqlRequestError } from '@/lib/graphql/client';
import { testLocalizer } from '@/lib/i18n/testing';
import { candidateArgs, statementErrorMessage } from './api';
import { POLL_MAX_MS, pollDecision } from './poll';
import type {
  ApiStatementDetail,
  ApiStatementLine,
  StatementAccount,
} from './types';
import { apiErrorText, statementUploadErrorKey } from './upload';
import {
  accountsById,
  categoriesById,
  hasDifference,
  lineCounts,
  parserLabel,
  periodLabel,
  toLineView,
  toStatementDetailView,
  toStatementListItem,
  uploadAccountOptions,
} from './view';

const es = testLocalizer('es');
const today = '2026-10-13';

const card: StatementAccount = {
  id: 'card-1',
  name: 'Banamex Oro',
  type: 'credit',
  currency: 'MXN',
  archived: false,
  metadata: { nickname: 'Mi Oro', last4: '1234', bank: 'Banamex' },
};

const line = (over: Partial<ApiStatementLine> = {}): ApiStatementLine => ({
  id: 'l-1',
  date: '2026-10-02T00:00:00.000Z',
  postDate: null,
  description: 'NETFLIX.COM',
  merchant: null,
  amount: 299,
  currency: 'MXN',
  kind: 'charge',
  status: 'pending',
  installmentNumber: null,
  installmentTotal: null,
  suggestedCategoryId: 'cat-subs',
  matchedTransactionId: null,
  matchedOccurrenceId: null,
  matchedRecurringPayment: null,
  ...over,
});

const statement = (
  over: Partial<ApiStatementDetail> = {},
): ApiStatementDetail => ({
  id: 'st-1',
  accountId: 'card-1',
  source: 'pdf',
  status: 'needs_review',
  parser: 'banamex_v1',
  periodStart: '2026-09-15T00:00:00.000Z',
  periodEnd: '2026-10-14T00:00:00.000Z',
  statementDate: '2026-10-14T00:00:00.000Z',
  paymentDueDate: '2026-11-03T00:00:00.000Z',
  previousBalance: 1000,
  totalCharges: 299,
  totalCredits: 500,
  statementBalance: 799,
  noInterestPayment: 799,
  minimumPayment: 150,
  currency: 'MXN',
  computedTotal: 799,
  difference: 0,
  errorMessage: null,
  confirmedAt: null,
  createdAt: '2026-10-13T16:00:00.000Z',
  lines: [line()],
  ...over,
});

const accounts = accountsById([card]);
const categories = categoriesById([
  { id: 'cat-subs', name: 'Suscripciones', parentId: null, key: null },
]);

describe('statements: list', () => {
  it('names the card, period, status and only a real difference', () => {
    const item = toStatementListItem(statement(), accounts, es);
    assert.equal(item.account, 'Mi Oro');
    assert.equal(item.period, '15 sep – 14 oct 2026');
    assert.equal(item.statusLabel, 'Por revisar');
    assert.equal(item.balance, '$799.00');
    assert.equal(item.difference, null);
    assert.equal(item.href, '/statements/st-1');

    const off = toStatementListItem(
      statement({ difference: -42.5 }),
      accounts,
      es,
    );
    assert.equal(off.difference, '-$42.50');
    const pending = toStatementListItem(
      statement({
        status: 'processing',
        periodStart: null,
        periodEnd: null,
        statementDate: null,
      }),
      new Map(),
      es,
    );
    assert.equal(pending.period, 'Periodo por leer');
    assert.equal(pending.account, 'Cuenta eliminada');
  });

  it('only offers active credit cards for upload', () => {
    assert.deepEqual(
      uploadAccountOptions([
        card,
        { ...card, id: 'debit', type: 'debit' },
        { ...card, id: 'old', archived: true },
      ]),
      [{ value: 'card-1', label: 'Mi Oro · 1234' }],
    );
  });
});

describe('statements: review', () => {
  it('signs lines by kind and shows installments', () => {
    const charge = toLineView(line(), categories, es);
    assert.equal(charge.amount, '-$299.00');
    assert.equal(charge.variant, 'expense');
    assert.equal(charge.categoryLabel, 'Suscripciones');
    assert.equal(charge.date, '2 oct');
    const payment = toLineView(
      line({
        kind: 'payment',
        amount: 500,
        description: 'PAGO GRACIAS',
        suggestedCategoryId: null,
      }),
      categories,
      es,
    );
    assert.equal(payment.amount, '+$500.00');
    assert.equal(payment.categoryLabel, null);
    const msi = toLineView(
      line({ kind: 'installment', installmentNumber: 3, installmentTotal: 12 }),
      categories,
      es,
    );
    assert.equal(msi.installments, '3/12');
    assert.equal(msi.kindLabel, 'Mensualidad');
  });

  it('links matched movements and recurring payments', () => {
    const view = toLineView(
      line({
        status: 'matched',
        matchedTransactionId: 't-9',
        matchedRecurringPayment: {
          occurrenceId: 'occ-1',
          recurringExpenseId: 'rec-1',
          name: 'Netflix',
          dueDate: '2026-10-05T00:00:00.000Z',
        },
      }),
      categories,
      es,
    );
    assert.equal(view.matchedTransactionHref, '/transactions/t-9');
    assert.deepEqual(view.recurring, {
      href: '/recurring?date=2026-10-05',
      label: 'Netflix',
    });
    assert.equal(view.statusLabel, 'Ya registrado');
  });

  it('builds the header, check and permissions', () => {
    const view = toStatementDetailView(
      statement(),
      accounts,
      categories,
      today,
      es,
    );
    assert.equal(view.parser, 'Banamex');
    assert.deepEqual(
      view.facts.map((f) => f.label),
      [
        'Saldo anterior',
        'Cargos',
        'Abonos',
        'Saldo al corte',
        'Pago mínimo',
        'Pago para no generar intereses',
        'Fecha de corte',
        'Fecha límite de pago',
      ],
    );
    assert.equal(view.check.mismatch, false);
    assert.ok(
      view.canEdit && view.canConfirm && view.canDelete && view.canReprocess,
    );
    assert.equal(view.fileHref, '/api/files/statements/st-1/file');

    const confirmed = toStatementDetailView(
      statement({ status: 'confirmed' }),
      accounts,
      categories,
      today,
      es,
    );
    assert.ok(
      !confirmed.canEdit && !confirmed.canDelete && !confirmed.canReprocess,
    );

    const processing = toStatementDetailView(
      statement({ status: 'processing' }),
      accounts,
      categories,
      today,
      es,
    );
    assert.ok(!processing.canDelete && !processing.canReprocess);

    const failed = toStatementDetailView(
      statement({
        status: 'failed',
        errorMessage: 'No movements were found',
        difference: 12,
      }),
      accounts,
      categories,
      today,
      es,
    );
    assert.equal(failed.errorMessage, 'No movements were found');
    assert.equal(failed.check.mismatch, true);
    assert.equal(failed.check.difference, '+$12.00');
  });

  it('labels the parser', () => {
    assert.equal(parserLabel(null, es.t), null);
    assert.equal(
      parserLabel('ai:anthropic/claude-sonnet-4-5', es.t),
      'IA: claude-sonnet-4-5',
    );
    assert.equal(parserLabel('ai', es.t), 'IA');
  });

  it('counts lines and treats half a cent as no difference', () => {
    assert.deepEqual(
      lineCounts([
        { status: 'pending' },
        { status: 'matched' },
        { status: 'pending' },
      ]),
      { pending: 2, matched: 1, created: 0, ignored: 0 },
    );
    assert.ok(!hasDifference(0.004));
    assert.ok(hasDifference(-0.01));
    assert.ok(!hasDifference(null));
  });

  it('shows the cut-off day alone when there is no start', () => {
    assert.equal(
      periodLabel(
        {
          periodStart: null,
          periodEnd: null,
          statementDate: '2026-10-14T00:00:00.000Z',
        },
        'en',
      ),
      'Oct 14 2026',
    );
  });
});

describe('statements: polling, linking and errors', () => {
  it('polls while extracting, up to the time limit', () => {
    assert.equal(pollDecision('processing', 0), 'continue');
    assert.equal(pollDecision('uploaded', POLL_MAX_MS - 1), 'continue');
    assert.equal(pollDecision('processing', POLL_MAX_MS), 'timeout');
    assert.equal(pollDecision('needs_review', 10), 'done');
    assert.equal(pollDecision('failed', 10), 'done');
  });

  it('searches candidates on the card by amount around the line day', () => {
    assert.deepEqual(
      candidateArgs('card-1', {
        rawAmount: 299,
        day: '2026-10-02',
        variant: 'expense',
      }),
      {
        accountId: 'card-1',
        amount: 299,
        date: '2026-10-02T12:00:00.000Z',
        type: 'expense',
      },
    );
    assert.equal(
      candidateArgs('card-1', {
        rawAmount: 500,
        day: '2026-10-02',
        variant: 'income',
      }).type,
      null,
    );
  });

  it('maps upload failures', () => {
    assert.equal(statementUploadErrorKey(0, null), 'network');
    assert.equal(statementUploadErrorKey(413, null), 'tooLarge');
    assert.equal(
      statementUploadErrorKey(400, 'The file is not a PDF'),
      'notPdf',
    );
    assert.equal(
      statementUploadErrorKey(
        400,
        'Statements can only be imported for credit cards',
      ),
      'notCredit',
    );
    assert.equal(
      statementUploadErrorKey(404, 'Account not found'),
      'accountNotFound',
    );
    assert.equal(statementUploadErrorKey(500, null), 'failed');
    assert.equal(apiErrorText({ message: ['a', 'b'] }), 'a');
    assert.equal(apiErrorText(null), null);
  });

  it('turns API refusals into friendly messages', () => {
    const msg = (message: string) =>
      statementErrorMessage(
        new GraphqlRequestError(message, 'CONFLICT', true),
        es.t,
      );
    assert.match(
      msg('This transaction is already linked to another movement'),
      /ya está vinculado/,
    );
    assert.match(
      msg(
        'A confirmed statement cannot be deleted; its transactions already exist',
      ),
      /confirmado/,
    );
    assert.match(msg('Only statements in review can be edited'), /revisión/);
  });
});
