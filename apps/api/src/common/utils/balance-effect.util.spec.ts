import { TransactionType } from '@finnit/database';
import {
  appliedEffect,
  defaultEffect,
  effectOf,
  moveBalance,
  withAmount,
} from './balance-effect.util';

describe('balance effect', () => {
  it('income adds and the rest takes when nothing else says so', () => {
    expect(defaultEffect(TransactionType.income, 100)).toBe(100);
    expect(defaultEffect(TransactionType.expense, 100)).toBe(-100);
    expect(defaultEffect(TransactionType.expense, -100.005)).toBe(-100.01);
  });

  it('uses the stored effect, or the type for older rows', () => {
    const adjustment = { type: TransactionType.adjustment, amount: 50 };
    expect(effectOf({ ...adjustment, balanceEffect: 50 })).toBe(50);
    expect(effectOf({ ...adjustment, balanceEffect: null })).toBe(-50);
  });

  it('a pending movement adds nothing; a new amount keeps the direction', () => {
    expect(appliedEffect(80, true)).toBe(0);
    expect(appliedEffect(-80, false)).toBe(-80);
    expect(withAmount(-80, 120)).toBe(-120);
    expect(withAmount(80, 120)).toBe(120);
  });

  it('moves the balance only when something changes', async () => {
    const update = jest.fn();
    const tx = { account: { update } } as never;
    await moveBalance(tx, 'a', 0);
    expect(update).not.toHaveBeenCalled();
    await moveBalance(tx, 'a', 10.004);
    expect(update).toHaveBeenCalledWith({
      where: { id: 'a' },
      data: { balanceCurrent: { increment: 10 } },
    });
  });
});
