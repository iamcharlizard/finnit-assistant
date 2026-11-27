import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { previewAllocation, type PendingPayment } from './allocation';

const pending = (id: string, due: number): PendingPayment => ({
  occurrenceId: id,
  dueDate: `2026-12-${id}`,
  dateLabel: id,
  due,
  dueLabel: String(due),
  concepts: [],
});
const rows = [pending('01', 300), pending('15', 300), pending('31', 300)];

describe('previewAllocation', () => {
  it('covers the chosen payments exactly', () => {
    const p = previewAllocation(600, rows, ['01', '15'], 'balance');
    assert.equal(p.shortfall, 0);
    assert.equal(p.surplus, 0);
    assert.equal(p.partial, null);
    assert.deepEqual(
      p.allocations.map((a) => [a.occurrenceId, a.amount, a.settles]),
      [
        ['01', 300, true],
        ['15', 300, true],
      ],
    );
  });

  it('leaves the last chosen one paid in part when short', () => {
    const p = previewAllocation(450, rows, ['01', '15'], 'balance');
    assert.equal(p.shortfall, 150);
    assert.equal(p.partial?.occurrenceId, '15');
  });

  it('gives the surplus to the next ones or keeps it as an abono', () => {
    const next = previewAllocation(700, rows, ['01', '15'], 'next');
    assert.equal(next.surplus, 100);
    assert.equal(next.toBalance, 0);
    assert.deepEqual(next.allocations.at(-1), {
      occurrenceId: '31',
      amount: 100,
      settles: false,
    });
    const balance = previewAllocation(700, rows, ['01', '15'], 'balance');
    assert.equal(balance.toBalance, 100);
  });

  it('is all to the balance without chosen payments', () => {
    const p = previewAllocation(80, rows, [], 'balance');
    assert.deepEqual(p.allocations, []);
    assert.equal(p.toBalance, 80);
  });
});
