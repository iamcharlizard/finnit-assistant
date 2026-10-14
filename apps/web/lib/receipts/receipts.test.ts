import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { emptyEntryDraft, type EntryDraft } from '@/lib/new-entry/form';
import type { SimilarTransaction } from '@/lib/new-entry/graphql';
import { discardWhenSettled } from './discard';
import type { ReceiptImport, ReceiptStatus } from './graphql';
import {
  amountText,
  buildConfirmInput,
  pendingReceipts,
  prefillFromReceipt,
  readSourceKey,
  receiptDayKey,
  receiptMatches,
} from './prefill';
import {
  READER_IDLE,
  RECEIPT_POLL_MAX_MS,
  leftoverReceiptId,
  readerReducer,
  type ReaderState,
} from './reader';
import {
  parseUploadResponse,
  receiptFileUrl,
  receiptUploadErrorKey,
} from './upload';

const TODAY = '2026-10-13';
const ID = '6f1c1e9a-3b0e-4c1a-9d55-0d3c2b1a9e01';
const ACCOUNTS = [{ id: 'acc-debit' }, { id: 'acc-card' }];
const CATEGORIES = [{ id: 'cat-food' }, { id: 'cat-home' }];

function receipt(overrides: Partial<ReceiptImport> = {}): ReceiptImport {
  return {
    id: ID,
    status: 'needs_review',
    fileName: 'ticket.jpg',
    route: 'ocr_rules',
    confidence: 'high',
    total: 245.5,
    currency: 'MXN',
    date: '2026-10-10T00:00:00.000Z',
    merchantName: 'Farmacia del Centro',
    merchantTaxId: 'FCE010101AB1',
    cardLast4: '4321',
    suggestedAccount: { id: 'acc-card' },
    suggestedCategory: { id: 'cat-home' },
    matchedTransaction: null,
    transaction: null,
    errorMessage: null,
    createdAt: '2026-10-13T15:00:00.000Z',
    ...overrides,
  };
}

function match(id: string): SimilarTransaction {
  return {
    id,
    type: 'expense',
    amount: 245.5,
    currency: 'MXN',
    txnDate: '2026-10-10T00:00:00.000Z',
    description: null,
    merchantName: 'FARMACIA',
    displayName: 'FARMACIA',
  };
}

const blank = (): EntryDraft => emptyEntryDraft('expense', TODAY);

describe('readerReducer', () => {
  const reading = (startedAt = 1_000): ReaderState => ({
    phase: 'reading',
    receiptId: ID,
    startedAt,
    immediate: false,
  });

  it('uploads with progress, then reads', () => {
    let state = readerReducer(READER_IDLE, { type: 'start' });
    assert.deepEqual(state, { phase: 'uploading', progress: 0 });
    state = readerReducer(state, { type: 'progress', percent: 40 });
    assert.deepEqual(state, { phase: 'uploading', progress: 40 });
    state = readerReducer(state, {
      type: 'uploaded',
      receipt: { id: ID, status: 'uploaded' },
      now: 1_000,
    });
    assert.deepEqual(state, reading());
  });

  it('asks right away when the upload returns a finished import (same photo)', () => {
    const state = readerReducer(
      { phase: 'uploading', progress: 100 },
      {
        type: 'uploaded',
        receipt: { id: ID, status: 'needs_review' },
        now: 5,
      },
    );
    assert.equal(state.phase === 'reading' && state.immediate, true);
  });

  it('maps upload failures to messages', () => {
    const failed = (status: number) =>
      readerReducer(
        { phase: 'uploading', progress: 10 },
        { type: 'uploadFailed', status },
      );
    assert.deepEqual(failed(0), {
      phase: 'failed',
      reason: 'uploadNetwork',
      receiptId: null,
    });
    const tooLarge = failed(413);
    assert.equal(
      tooLarge.phase === 'failed' && tooLarge.reason,
      'uploadTooLarge',
    );
  });

  it('keeps reading while the server works, within a minute', () => {
    const state = reading();
    const next = readerReducer(state, {
      type: 'polled',
      receipt: receipt({ status: 'processing' }),
      now: 1_000 + RECEIPT_POLL_MAX_MS - 1,
    });
    assert.equal(next, state);
    assert.equal(
      readerReducer(state, { type: 'pollFailed', now: 2_000 }),
      state,
    );
  });

  it('times out after a minute, and can keep waiting', () => {
    const timedOut = readerReducer(reading(), {
      type: 'polled',
      receipt: receipt({ status: 'processing' }),
      now: 1_000 + RECEIPT_POLL_MAX_MS,
    });
    assert.deepEqual(timedOut, {
      phase: 'failed',
      reason: 'timeout',
      receiptId: ID,
    });
    assert.deepEqual(
      readerReducer(timedOut, { type: 'keepWaiting', now: 99 }),
      { phase: 'reading', receiptId: ID, startedAt: 99, immediate: true },
    );
    assert.equal(
      readerReducer(reading(), {
        type: 'pollFailed',
        now: 1_000 + RECEIPT_POLL_MAX_MS,
      }).phase,
      'failed',
    );
  });

  it('ends on the final statuses', () => {
    const outcome = (status: ReceiptImport['status']) =>
      readerReducer(reading(), {
        type: 'polled',
        receipt: receipt({ status }),
        now: 2_000,
      });
    assert.deepEqual(outcome('needs_review'), {
      phase: 'ready',
      receipt: receipt(),
    });
    assert.deepEqual(outcome('failed'), {
      phase: 'failed',
      reason: 'readFailed',
      receiptId: ID,
    });
    const confirmed = outcome('confirmed');
    assert.equal(
      confirmed.phase === 'failed' && confirmed.reason,
      'alreadyConfirmed',
    );
    const discarded = outcome('discarded');
    assert.equal(discarded.phase === 'failed' && discarded.reason, 'discarded');
  });

  it('ignores answers for another receipt or out of turn', () => {
    const state = reading();
    assert.equal(
      readerReducer(state, {
        type: 'polled',
        receipt: receipt({ id: 'other' }),
        now: 2_000,
      }),
      state,
    );
    assert.equal(
      readerReducer(READER_IDLE, { type: 'progress', percent: 5 }),
      READER_IDLE,
    );
  });

  it('resets', () => {
    assert.equal(readerReducer(reading(), { type: 'reset' }), READER_IDLE);
  });

  it('knows which import a manual capture should discard', () => {
    assert.equal(
      leftoverReceiptId({
        phase: 'failed',
        reason: 'readFailed',
        receiptId: ID,
      }),
      ID,
    );
    assert.equal(
      leftoverReceiptId({ phase: 'failed', reason: 'timeout', receiptId: ID }),
      ID,
    );
    assert.equal(
      leftoverReceiptId({
        phase: 'failed',
        reason: 'alreadyConfirmed',
        receiptId: ID,
      }),
      null,
    );
    assert.equal(
      leftoverReceiptId({
        phase: 'failed',
        reason: 'uploadNetwork',
        receiptId: null,
      }),
      null,
    );
    assert.equal(leftoverReceiptId(reading()), ID);
  });
});

describe('receiptDayKey', () => {
  it('keeps the calendar day of date-only values', () => {
    assert.equal(receiptDayKey('2026-10-10T00:00:00.000Z'), '2026-10-10');
    assert.equal(receiptDayKey('2026-10-10'), '2026-10-10');
  });

  it('reads timestamps in Mexico City time', () => {
    // 00:30 UTC on the 11th is 18:30 on the 10th in Mexico City.
    assert.equal(receiptDayKey('2026-10-11T00:30:00.000Z'), '2026-10-10');
  });

  it('returns null for missing or invalid dates', () => {
    assert.equal(receiptDayKey(null), null);
    assert.equal(receiptDayKey('not a date'), null);
  });
});

describe('prefillFromReceipt', () => {
  it('fills amount, date, merchant, account and category', () => {
    const { draft, check } = prefillFromReceipt(
      { ...blank(), note: 'Medicinas' },
      receipt(),
      ACCOUNTS,
      CATEGORIES,
      TODAY,
    );
    assert.deepEqual(draft, {
      type: 'expense',
      amount: '245.50',
      date: '2026-10-10',
      merchant: 'Farmacia del Centro',
      note: 'Medicinas',
      accountId: 'acc-card',
      categoryId: 'cat-home',
      categoryPicked: true,
    });
    assert.deepEqual(check, []);
  });

  it('keeps what the user had when the receipt lacks it', () => {
    const { draft, check } = prefillFromReceipt(
      {
        ...blank(),
        amount: '99',
        merchant: 'Oxxo',
        accountId: 'acc-debit',
        categoryId: 'cat-food',
      },
      receipt({
        total: null,
        merchantName: '  ',
        date: null,
        suggestedAccount: null,
        suggestedCategory: null,
      }),
      ACCOUNTS,
      CATEGORIES,
      TODAY,
    );
    assert.equal(draft.amount, '99');
    assert.equal(draft.merchant, 'Oxxo');
    assert.equal(draft.date, TODAY);
    assert.equal(draft.accountId, 'acc-debit');
    assert.equal(draft.categoryId, 'cat-food');
    assert.equal(draft.categoryPicked, false);
    // Not on the receipt: worth a look.
    assert.deepEqual(check, ['amount', 'date', 'merchant']);
  });

  it('ignores suggestions that are not among the user accounts or categories', () => {
    const { draft, check } = prefillFromReceipt(
      blank(),
      receipt({
        suggestedAccount: { id: 'archived' },
        suggestedCategory: { id: 'gone' },
      }),
      ACCOUNTS,
      CATEGORIES,
      TODAY,
    );
    assert.equal(draft.accountId, undefined);
    assert.equal(draft.categoryId, undefined);
    assert.deepEqual(check, ['accountId']);
  });

  it('picks the only account when there is no suggestion', () => {
    const { draft } = prefillFromReceipt(
      blank(),
      receipt({ suggestedAccount: null }),
      [{ id: 'acc-debit' }],
      CATEGORIES,
      TODAY,
    );
    assert.equal(draft.accountId, 'acc-debit');
  });

  it('does not use a date after today', () => {
    const { draft, check } = prefillFromReceipt(
      blank(),
      receipt({ date: '2026-12-01T00:00:00.000Z' }),
      ACCOUNTS,
      CATEGORIES,
      TODAY,
    );
    assert.equal(draft.date, TODAY);
    assert.deepEqual(check, ['date']);
  });

  it('highlights everything read with low confidence', () => {
    const low = prefillFromReceipt(
      blank(),
      receipt({ confidence: 'low' }),
      ACCOUNTS,
      CATEGORIES,
      TODAY,
    );
    assert.deepEqual(low.check, ['amount', 'date', 'merchant']);
    const medium = prefillFromReceipt(
      blank(),
      receipt({ confidence: 'medium', merchantName: null }),
      ACCOUNTS,
      CATEGORIES,
      TODAY,
    );
    assert.deepEqual(medium.check, ['merchant']);
  });
});

describe('amountText', () => {
  it('writes totals with cents and rejects non-positive ones', () => {
    assert.equal(amountText(80), '80.00');
    assert.equal(amountText(1234.5), '1234.50');
    assert.equal(amountText(0), null);
    assert.equal(amountText(null), null);
    assert.equal(amountText(Number.NaN), null);
  });
});

describe('readSourceKey', () => {
  it('names how the receipt was read', () => {
    assert.equal(readSourceKey('cfdi_qr'), 'qr');
    assert.equal(readSourceKey('ocr_rules'), 'ocr');
    assert.equal(readSourceKey('ai'), 'ai');
    assert.equal(readSourceKey(null), null);
  });
});

describe('buildConfirmInput', () => {
  const ready: EntryDraft = {
    ...blank(),
    amount: '$1,245.50',
    date: '2026-10-10',
    merchant: ' Farmacia ',
    note: '  ',
    accountId: 'acc-card',
    categoryId: 'cat-home',
  };

  it('creates a new expense from the form', () => {
    assert.deepEqual(buildConfirmInput(ready), {
      accountId: 'acc-card',
      categoryId: 'cat-home',
      total: 1245.5,
      date: '2026-10-10',
      merchantName: 'Farmacia',
      description: null,
    });
  });

  it('attaches the photo to an existing movement', () => {
    assert.deepEqual(
      buildConfirmInput({ ...ready, categoryId: undefined }, 'tx-1'),
      {
        accountId: 'acc-card',
        categoryId: null,
        total: 1245.5,
        date: '2026-10-10',
        merchantName: 'Farmacia',
        description: null,
        attachToTransactionId: 'tx-1',
      },
    );
  });
});

describe('receiptMatches', () => {
  it('puts the server match first and drops repeats', () => {
    assert.deepEqual(
      receiptMatches({ matchedTransaction: match('a') }, [
        match('b'),
        match('a'),
      ]).map((m) => m.id),
      ['a', 'b'],
    );
    assert.deepEqual(receiptMatches({ matchedTransaction: null }, null), []);
  });
});

describe('pendingReceipts', () => {
  it('keeps only receipts waiting for review, newest first', () => {
    const list = [
      receipt({ id: '1', createdAt: '2026-10-11T00:00:00.000Z' }),
      receipt({ id: '2', status: 'confirmed' }),
      receipt({ id: '3', createdAt: '2026-10-12T00:00:00.000Z' }),
      receipt({ id: '4', status: 'processing' }),
    ];
    assert.deepEqual(
      pendingReceipts(list).map((r) => r.id),
      ['3', '1'],
    );
    assert.equal(pendingReceipts(list, 1).length, 1);
  });
});

describe('upload helpers', () => {
  it('maps HTTP statuses to messages', () => {
    assert.equal(receiptUploadErrorKey(0), 'uploadNetwork');
    assert.equal(receiptUploadErrorKey(413), 'uploadTooLarge');
    assert.equal(receiptUploadErrorKey(400), 'uploadInvalid');
    assert.equal(receiptUploadErrorKey(500), 'uploadFailed');
  });

  it('reads the 202 body', () => {
    assert.deepEqual(
      parseUploadResponse(`{"id":"${ID}","status":"uploaded"}`),
      {
        id: ID,
        status: 'uploaded',
      },
    );
    assert.equal(parseUploadResponse('{"id":1}'), null);
    assert.equal(parseUploadResponse('<html>'), null);
  });

  it('builds the photo URL only for UUIDs', () => {
    assert.equal(receiptFileUrl(ID), `/api/files/receipts/${ID}/file`);
    assert.equal(receiptFileUrl('../secret'), null);
  });
});

describe('discardWhenSettled', () => {
  function deps(statuses: ReceiptStatus[], discardFails = false) {
    const calls = { discard: 0, waits: 0 };
    let i = 0;
    return {
      calls,
      deps: {
        fetchStatus: async () => statuses[Math.min(i++, statuses.length - 1)]!,
        discard: async () => {
          calls.discard += 1;
          if (discardFails) throw new Error('conflict');
        },
        wait: async () => {
          calls.waits += 1;
        },
      },
    };
  }

  it('waits for the read to end, then discards', async () => {
    const { calls, deps: d } = deps([
      'processing',
      'processing',
      'needs_review',
    ]);
    assert.equal(await discardWhenSettled(ID, d), true);
    assert.deepEqual(calls, { discard: 1, waits: 2 });
  });

  it('leaves confirmed and already discarded imports alone', async () => {
    const confirmed = deps(['confirmed']);
    assert.equal(await discardWhenSettled(ID, confirmed.deps), false);
    assert.equal(confirmed.calls.discard, 0);
    const discarded = deps(['discarded']);
    assert.equal(await discardWhenSettled(ID, discarded.deps), true);
    assert.equal(discarded.calls.discard, 0);
  });

  it('gives up quietly', async () => {
    const stuck = deps(['processing']);
    assert.equal(
      await discardWhenSettled(ID, stuck.deps, { maxAttempts: 3 }),
      false,
    );
    assert.equal(stuck.calls.waits, 3);
    const failing = deps(['failed'], true);
    assert.equal(await discardWhenSettled(ID, failing.deps), false);
  });
});
