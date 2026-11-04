import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { testLocalizer } from '@/lib/i18n/testing';
import type { ScreenshotImport, ScreenshotLine } from './graphql';
import {
  buildScreenshotReview,
  lineChangeOf,
  lineDraftOf,
  validateLineDraft,
} from './view';

const es = testLocalizer('es');
const line = (patch: Partial<ScreenshotLine> = {}): ScreenshotLine => ({
  id: 'l1',
  date: '2026-11-02T00:00:00.000Z',
  merchant: 'Netflix',
  amount: 299,
  direction: 'out',
  inProcess: true,
  review: [],
  status: 'pending',
  categoryId: null,
  matchedTransaction: null,
  ...patch,
});
const shot = (lines: ScreenshotLine[]): ScreenshotImport => ({
  id: 's1',
  status: 'needs_review',
  accountHint: 'Clásica Banamex **482',
  last4: '482',
  account: { id: 'a1', name: 'Clásica', currency: 'MXN' },
  lines,
  movementsRead: lines.length,
  errorMessage: null,
});

describe('screenshot review', () => {
  it('counts what will be saved, what is registered and what to check', () => {
    const review = buildScreenshotReview(
      shot([
        line(),
        line({ id: 'l2', amount: 2500, direction: 'in', inProcess: false }),
        line({
          id: 'l3',
          status: 'matched',
          matchedTransaction: {
            id: 't',
            date: '2026-11-02T00:00:00.000Z',
            amount: 499,
            name: 'Smartfit',
          },
        }),
        line({ id: 'l4', merchant: 'Dïdi', review: ['date'] }),
        line({ id: 'l5', status: 'ignored' }),
      ]),
      es,
    );
    assert.equal(review.toSave, 3);
    assert.equal(review.alreadyRegistered, 1);
    assert.equal(review.toCheck, 1);
    assert.equal(review.blocked, false);
    assert.match(review.total, /^\+\$1,902\.00/);
    const [netflix, refund, gym, didi] = review.rows;
    assert.match(netflix!.amount, /^-\$299\.00/);
    assert.equal(netflix!.date, '2 nov');
    assert.equal(netflix!.inProcess, true);
    assert.match(refund!.amount, /^\+\$2,500\.00/);
    assert.equal(gym!.included, false);
    assert.equal(gym!.registered?.name, 'Smartfit');
    assert.equal(didi!.checkDate, true);
  });

  it('a line without amount blocks saving until it is fixed or left out', () => {
    assert.equal(
      buildScreenshotReview(shot([line({ amount: 0 })]), es).blocked,
      true,
    );
    assert.equal(
      buildScreenshotReview(shot([line({ amount: 0, status: 'ignored' })]), es)
        .blocked,
      false,
    );
  });

  it('sends only what changed, or the checked fields of a flagged line', () => {
    const base = line({ review: ['date'] });
    const draft = lineDraftOf(base);
    assert.deepEqual(validateLineDraft(draft, '2026-11-03'), {});
    assert.deepEqual(lineChangeOf(base, draft), {
      date: '2026-11-02T00:00:00.000Z',
    });
    assert.equal(lineChangeOf(line(), lineDraftOf(line())), null);
    assert.deepEqual(
      lineChangeOf(line(), {
        ...lineDraftOf(line()),
        merchant: ' Netflix Premium ',
        amount: '310',
        inProcess: false,
      }),
      { merchant: 'Netflix Premium', amount: 310, inProcess: false },
    );
    assert.deepEqual(
      validateLineDraft(
        { ...draft, amount: '', merchant: ' ', date: '2026-12-01' },
        '2026-11-03',
      ),
      {
        amount: 'amountRequired',
        merchant: 'merchantRequired',
        date: 'dateInvalid',
      },
    );
  });
});
