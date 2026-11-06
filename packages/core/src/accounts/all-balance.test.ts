import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { testLocalizer } from '../i18n/testing';
import {
  buildOverviewTimeline,
  type ApiAllBalanceHistory,
} from './all-balance';

const es = testLocalizer('es');
const today = '2026-11-03';

const history: ApiAllBalanceHistory = {
  currency: 'MXN',
  accounts: 3,
  days: [
    {
      date: '2026-11-03T00:00:00.000Z',
      availableOpening: 1050,
      availableClosing: 850,
      debtOpening: 300,
      debtClosing: 500,
      movements: 3,
      complete: true,
    },
    {
      date: '2026-11-02T00:00:00.000Z',
      availableOpening: 950,
      availableClosing: 1050,
      debtOpening: 300,
      debtClosing: 300,
      movements: 0,
      complete: false,
    },
  ],
};

describe('all accounts together', () => {
  it("builds the chosen day's figures and both lines, oldest first", () => {
    const overview = buildOverviewTimeline(
      history,
      { day: '2026-11-02', today, hasCards: true },
      es,
    )!;
    assert.equal(overview.isToday, false);
    assert.equal(overview.nextDay, today);
    assert.equal(overview.complete, false);
    assert.match(overview.availableClosing, /1,050\.00/);
    assert.match(overview.debtClosing, /300\.00/);
    assert.deepEqual(overview.available.values, [1050, 850]);
    assert.deepEqual(overview.debt.values, [300, 500]);
    assert.deepEqual(
      overview.days.map((d) => [d.day, d.complete]),
      [
        ['2026-11-02', false],
        [today, true],
      ],
    );
    assert.equal(overview.completeFromLabel, '3 de noviembre de 2026');
    assert.equal(overview.hasDebt, true);
  });

  it('is today by default, and nothing without accounts', () => {
    const now = buildOverviewTimeline(
      history,
      { day: null, today, hasCards: false },
      es,
    )!;
    assert.equal(now.isToday, true);
    assert.equal(now.movements, 3);
    assert.equal(now.hasDebt, false);
    assert.equal(
      buildOverviewTimeline(
        { currency: null, accounts: 0, days: [] },
        { day: null, today, hasCards: false },
        es,
      ),
      null,
    );
  });
});
