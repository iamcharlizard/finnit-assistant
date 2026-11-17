import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { donutPaths, pieSlices } from './pie';

const money = (n: number) => `$${n}`;

describe('pie slices', () => {
  it('orders by size and folds the rest into Otros past six', () => {
    const entries = Array.from({ length: 8 }, (_, i) => ({
      key: `k${i}`,
      label: `L${i}`,
      value: (i + 1) * 10,
      count: 1,
    }));
    const slices = pieSlices(entries, { money, otherLabel: 'Otros' });
    assert.equal(slices.length, 6);
    assert.equal(slices[0]!.key, 'k7');
    assert.equal(slices[0]!.color, 'var(--chart-1)');
    assert.deepEqual(
      { key: slices[5]!.key, value: slices[5]!.value, count: slices[5]!.count },
      { key: 'other', value: 60, count: 3 },
    );
    assert.equal(
      pieSlices([{ key: 'a', label: 'A', value: 0, count: 1 }], {
        money,
        otherLabel: 'Otros',
      }).length,
      0,
    );
  });

  it('draws one arc per slice, a full ring for a lone one', () => {
    const [a, b] = donutPaths([1, 1], { size: 100, thickness: 20 });
    assert.match(a!, /^M 50\.000 0\.000 A 50 50 0 0 1 50\.000 100\.000/);
    assert.ok(b!.length > 0);
    const ring = donutPaths([5], { size: 100, thickness: 20 })[0]!;
    assert.equal(ring.split('A').length, 5);
  });
});
