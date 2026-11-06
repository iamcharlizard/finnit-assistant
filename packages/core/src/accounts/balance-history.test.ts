import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { direction } from '../finance/transactions';
import type { ApiTransaction } from '../finance/types';
import { testLocalizer } from '../i18n/testing';
import {
  buildBalanceTimeline,
  historyWindow,
  parseDayParam,
  type ApiBalanceHistory,
} from './balance-history';

const es = testLocalizer('es');
const today = '2026-11-03';

const history: ApiBalanceHistory = {
  accountId: 'a',
  currency: 'MXN',
  completeFrom: '2026-11-02T00:00:00.000Z',
  days: [
    ['2026-11-03', 800, 750, 0, 50, 1, true],
    ['2026-11-02', 1000, 800, 0, 200, 1, true],
    ['2026-11-01', 1000, 1000, 0, 0, 0, false],
  ].map(
    ([
      date,
      openingBalance,
      closingBalance,
      inflow,
      outflow,
      movements,
      complete,
    ]) => ({
      date: `${date}T00:00:00.000Z`,
      openingBalance: openingBalance as number,
      closingBalance: closingBalance as number,
      inflow: inflow as number,
      outflow: outflow as number,
      movements: movements as number,
      complete: complete as boolean,
    }),
  ),
};

describe('balance by day', () => {
  it('only past days are a chosen day', () => {
    assert.equal(parseDayParam('2026-11-02', today), '2026-11-02');
    assert.equal(parseDayParam(today, today), null);
    assert.equal(parseDayParam('2026-12-01', today), null);
    assert.equal(parseDayParam('nope', today), null);
    assert.equal(parseDayParam(['2026-10-01', 'x'], today), '2026-10-01');
    assert.equal(parseDayParam(undefined, today), null);
  });

  it('the chart shows the last 90 days, or around an older day', () => {
    assert.deepEqual(historyWindow(null, today), {
      from: '2026-08-06',
      to: today,
    });
    assert.deepEqual(historyWindow('2026-10-01', today), {
      from: '2026-08-06',
      to: today,
    });
    assert.deepEqual(historyWindow('2026-01-15', today), {
      from: '2026-01-01',
      to: today,
    });
    // Never more than 366 days.
    assert.deepEqual(historyWindow('2024-06-15', today), {
      from: '2024-06-01',
      to: '2025-06-01',
    });
  });

  it("builds the chosen day's figures and the points, oldest first", () => {
    const timeline = buildBalanceTimeline(
      history,
      { day: '2026-11-02', today, isCredit: false },
      es,
    )!;
    assert.equal(timeline.isToday, false);
    assert.equal(timeline.today, today);
    assert.equal(timeline.previousDay, '2026-11-01');
    assert.equal(timeline.nextDay, today);
    assert.equal(timeline.dayLabel, '2 de noviembre de 2026');
    assert.match(timeline.opening, /1,000\.00/);
    assert.match(timeline.closing, /800\.00/);
    assert.match(timeline.outflow, /200\.00/);
    assert.equal(timeline.complete, true);
    assert.deepEqual(
      timeline.points.map((p) => [p.day, p.value, p.complete]),
      [
        ['2026-11-01', 1000, false],
        ['2026-11-02', 800, true],
        [today, 750, true],
      ],
    );
    assert.ok(timeline.completeFromLabel);
  });

  it('today has no next day; a card shows what is owed', () => {
    const card = buildBalanceTimeline(
      {
        ...history,
        days: history.days.map((d) => ({
          ...d,
          openingBalance: -d.openingBalance,
          closingBalance: -d.closingBalance,
        })),
      },
      { day: null, today, isCredit: true },
      es,
    )!;
    assert.equal(card.isToday, true);
    assert.equal(card.nextDay, null);
    assert.equal(card.points.at(-1)!.value, 750);
    assert.doesNotMatch(card.closing, /-/);
  });

  it('is null when the day is outside the history', () => {
    assert.equal(
      buildBalanceTimeline(
        history,
        { day: '2026-10-01', today, isCredit: false },
        es,
      ),
      null,
    );
  });

  it("a movement's recorded effect gives its direction", () => {
    const tx = (patch: Partial<ApiTransaction>) =>
      ({ type: 'adjustment', amount: 100, ...patch }) as ApiTransaction;
    assert.equal(direction(tx({ balanceEffect: 100 })), 'in');
    assert.equal(direction(tx({ balanceEffect: -100 })), 'out');
    assert.equal(direction(tx({ type: 'transfer', balanceEffect: 100 })), 'in');
    assert.equal(direction(tx({ balanceEffect: null })), 'unknown');
  });
});
