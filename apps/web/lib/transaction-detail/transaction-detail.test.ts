import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { testLocalizer } from '@/lib/i18n/testing';
import { GraphqlRequestError } from '@/lib/graphql/client';
import { transactionErrorMessage } from './api';
import { buildUpdateInput, detailFormOf, validateDetailForm } from './form';
import type { TransactionDetail } from './types';
import { ownNameUpdate, shownSuggestion } from './edit';
import {
  deleteBlock,
  editRules,
  formatFileSize,
  sourceKind,
  toAttachmentView,
  toTransactionDetailView,
} from './view';

const tx = (over: Partial<TransactionDetail> = {}): TransactionDetail => ({
  id: 't-1',
  type: 'expense',
  amount: 80,
  currency: 'MXN',
  txnDate: '2026-10-12T00:00:00.000Z',
  description: 'Cena',
  merchantName: 'La Fonda',
  isPending: false,
  source: 'manual',
  transferDirection: null,
  accountId: 'acc-1',
  account: {
    id: 'acc-1',
    name: 'BBVA Débito',
    type: 'debit',
    metadata: { nickname: 'Nómina' },
  },
  category: { id: 'cat-food', name: 'Comida', parentId: null },
  displayName: 'La Fonda',
  isPrivate: false,
  aliasId: null,
  hasOwnAlias: false,
  originalDescription: 'La Fonda',
  notes: null,
  categorySource: 'manual',
  attachments: [],
  transferCounterpart: null,
  recurringPayment: null,
  ...over,
});

const es = testLocalizer('es');
const today = '2026-10-13';

describe('transaction detail: what can change', () => {
  it('manual income/expense: everything', () => {
    assert.deepEqual(editRules(tx()), {
      amount: true,
      date: true,
      merchant: true,
      description: true,
      category: true,
      notes: true,
    });
    assert.equal(deleteBlock(tx()), null);
  });

  it('bank and statement movements: only the category and notes, no delete', () => {
    for (const source of ['imported', 'statement']) {
      assert.deepEqual(editRules(tx({ source })), {
        amount: false,
        date: false,
        merchant: false,
        description: false,
        category: true,
        notes: true,
      });
      assert.equal(deleteBlock(tx({ source })), 'imported');
    }
    // A bank adjustment still takes notes (and its name).
    const adjustment = editRules(
      tx({ source: 'imported', type: 'adjustment' }),
    );
    assert.equal(adjustment.category, false);
    assert.equal(adjustment.notes, true);
  });

  it('transfers keep amount, date and category; adjustments keep the amount', () => {
    const transfer = editRules(tx({ type: 'transfer' }));
    assert.equal(transfer.amount, false);
    assert.equal(transfer.date, false);
    assert.equal(transfer.category, false);
    assert.equal(transfer.description, true);
    assert.equal(deleteBlock(tx({ type: 'transfer' })), 'transfer');
    assert.equal(editRules(tx({ type: 'adjustment' })).amount, false);
  });

  it('names where it came from', () => {
    assert.equal(sourceKind('manual'), 'manual');
    assert.equal(sourceKind('imported'), 'bank');
    assert.equal(sourceKind('statement'), 'statement');
    assert.equal(sourceKind('ocr'), 'receipt');
  });
});

describe('transaction detail: the edit form', () => {
  const rules = editRules(tx());

  it('starts from the saved values', () => {
    assert.deepEqual(detailFormOf(tx()), {
      amount: '80.00',
      date: '2026-10-12',
      categoryId: 'cat-food',
      merchantName: 'La Fonda',
      description: 'Cena',
      notes: '',
    });
    assert.equal(detailFormOf(tx({ notes: 'Con Ana' })).notes, 'Con Ana');
  });

  it('sends only what changed and the rules allow', () => {
    const initial = detailFormOf(tx());
    assert.equal(buildUpdateInput(initial, initial, rules), null);
    assert.deepEqual(
      buildUpdateInput(
        { ...initial, amount: '1,250.5', merchantName: ' Oxxo ' },
        initial,
        rules,
      ),
      { amount: 1250.5, merchantName: 'Oxxo' },
    );
    const importedRules = editRules(tx({ source: 'imported' }));
    assert.deepEqual(
      buildUpdateInput(
        { ...initial, amount: '5', categoryId: 'cat-2', description: 'x' },
        initial,
        importedRules,
      ),
      { categoryId: 'cat-2' },
    );
    // Notes go on any movement; emptied ones are sent as "" (cleared).
    assert.deepEqual(
      buildUpdateInput(
        { ...initial, notes: '  Con Ana ' },
        initial,
        importedRules,
      ),
      { notes: 'Con Ana' },
    );
    assert.deepEqual(
      buildUpdateInput(
        { ...initial, notes: ' ' },
        { ...initial, notes: 'Con Ana' },
        rules,
      ),
      { notes: '' },
    );
    // An emptied category isn't sent (the API can't clear it).
    assert.equal(
      buildUpdateInput({ ...initial, categoryId: '' }, initial, rules),
      null,
    );
  });

  it('validates amount and date only when editable', () => {
    const form = { ...detailFormOf(tx()), amount: '0', date: '2026-10-20' };
    assert.deepEqual(validateDetailForm(form, rules, today), {
      amount: 'amountInvalid',
      date: 'dateInFuture',
    });
    assert.deepEqual(
      validateDetailForm(form, editRules(tx({ source: 'imported' })), today),
      {},
    );
    assert.equal(
      validateDetailForm({ ...form, amount: '' }, rules, today).amount,
      'amountRequired',
    );
  });
});

describe('transaction detail: view', () => {
  it('shows a signed amount, the account nickname and the category', () => {
    const view = toTransactionDetailView(tx(), today, es);
    assert.equal(view.title, 'La Fonda');
    assert.equal(view.amount, '-$80.00');
    assert.equal(view.variant, 'expense');
    assert.equal(view.accountLabel, 'Nómina');
    assert.equal(view.categoryLabel, 'Comida');
    assert.equal(view.dateLabel, '12 de octubre de 2026');
    assert.equal(view.original, null);
    assert.equal(view.typeLabel, 'Gasto');
  });

  it('keeps the original of a private movement for "Ver original"', () => {
    const view = toTransactionDetailView(
      tx({
        isPrivate: true,
        hasOwnAlias: true,
        displayName: 'Regalo',
        originalDescription: 'LIVERPOOL INSURGENTES',
      }),
      today,
      es,
    );
    assert.equal(view.title, 'Regalo');
    assert.equal(view.isPrivate, true);
    assert.equal(view.original, 'LIVERPOOL INSURGENTES');
  });

  it('links the transfer side and the recurring payment', () => {
    const view = toTransactionDetailView(
      tx({
        type: 'transfer',
        transferDirection: 'out',
        category: null,
        transferCounterpart: {
          transferId: 'tr-1',
          converted: true,
          transactionId: 't-2',
          accountId: 'acc-2',
          accountName: 'Mi tarjeta',
          direction: 'out',
        },
        recurringPayment: {
          occurrenceId: 'occ-1',
          recurringExpenseId: 'rec-1',
          name: 'Netflix',
          dueDate: '2026-10-05T00:00:00.000Z',
        },
      }),
      today,
      es,
    );
    assert.deepEqual(view.counterpart, {
      transferId: 'tr-1',
      converted: true,
      transactionId: 't-2',
      label: 'Hacia Mi tarjeta',
    });
    assert.equal(view.convertSource, null);
    assert.deepEqual(toTransactionDetailView(tx(), today, es).convertSource, {
      id: 't-1',
      type: 'expense',
      accountId: 'acc-1',
      currency: 'MXN',
      amount: 80,
    });
    assert.deepEqual(view.recurring, {
      href: '/recurring?date=2026-10-05',
      label: 'Netflix · vencía el 5 de octubre',
    });
    assert.equal(view.categoryLabel, null);
    assert.equal(view.amount, '-$80.00');
  });

  it('downloads attachments through the file proxy', () => {
    assert.deepEqual(
      toAttachmentView(
        {
          id: 'a-1',
          fileName: 'ticket.jpg',
          fileType: 'image/jpeg',
          fileSize: 1_258_291,
          downloadPath: '/attachments/a-1/file',
          uploadedAt: '2026-10-12T10:00:00Z',
        },
        'Archivo',
      ),
      {
        id: 'a-1',
        name: 'ticket.jpg',
        meta: 'JPG · 1.2 MB',
        href: '/api/files/attachments/a-1/file',
      },
    );
    assert.equal(
      toAttachmentView(
        {
          id: 'a-2',
          fileName: null,
          fileType: 'application/pdf',
          fileSize: null,
          downloadPath: null,
          uploadedAt: '2026-10-12T10:00:00Z',
        },
        'Archivo',
      ).href,
      null,
    );
    assert.equal(formatFileSize(820 * 1024), '820 KB');
    assert.equal(formatFileSize(12), '12 B');
  });

  it('turns API refusals into friendly messages', () => {
    const msg = (message: string) =>
      transactionErrorMessage(
        new GraphqlRequestError(message, 'VALIDATION_ERROR', true),
        es.t,
      );
    assert.match(
      msg('Cannot delete transaction that is a debt payment'),
      /Deudas/,
    );
    assert.match(
      msg('Cannot delete transaction that is part of a transfer'),
      /transferencias/i,
    );
    assert.match(msg('Transaction not found'), /ya no existe/);
  });
});

describe('transaction detail: the editor', () => {
  const options = [
    { value: 'cat-food', label: 'Comida', group: 'Comida', keywords: [] },
    { value: 'cat-fun', label: 'Diversión', group: 'Diversión', keywords: [] },
  ];

  it('suggests a category only when it differs and the picker has it', () => {
    const similar = {
      categoryId: 'cat-fun',
      source: 'history' as const,
      count: 4,
    };
    assert.deepEqual(shownSuggestion(similar, 'cat-food', options), {
      ...similar,
      label: 'Diversión',
    });
    assert.equal(shownSuggestion(similar, 'cat-fun', options), null);
    assert.equal(
      shownSuggestion({ ...similar, categoryId: 'hidden' }, '', options),
      null,
    );
    assert.equal(shownSuggestion(null, '', options), null);
  });

  it('drops the own name once an automatic name is created', () => {
    const input = { displayName: 'Cena', isPrivate: true };
    assert.deepEqual(
      ownNameUpdate({
        ruleCreated: true,
        hasOwnAlias: true,
        changed: false,
        input,
      }),
      { displayName: null, isPrivate: true },
    );
    assert.equal(
      ownNameUpdate({
        ruleCreated: true,
        hasOwnAlias: false,
        changed: false,
        input,
      }),
      null,
    );
    assert.deepEqual(
      ownNameUpdate({
        ruleCreated: false,
        hasOwnAlias: false,
        changed: true,
        input,
      }),
      input,
    );
    assert.equal(
      ownNameUpdate({
        ruleCreated: false,
        hasOwnAlias: true,
        changed: false,
        input,
      }),
      null,
    );
  });
});
