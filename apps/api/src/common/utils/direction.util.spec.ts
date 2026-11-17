import { mockDeep } from 'jest-mock-extended';
import { Prisma, TransactionType } from '@finnit/database';

import {
  directionBlockOf,
  oppositeOf,
  turnMovement,
  type DirectionMovement,
} from './direction.util';

const movement = (
  overrides: Partial<DirectionMovement> = {},
): DirectionMovement => ({
  id: 'm1',
  accountId: 'acc',
  type: TransactionType.expense,
  amount: new Prisma.Decimal(250),
  balanceEffect: new Prisma.Decimal(-250),
  isPending: false,
  cancelledAt: null,
  categoryId: 'food',
  transferFrom: null,
  transferTo: null,
  debtPayment: null,
  debtCharge: null,
  debtDisbursement: null,
  debtPurchase: null,
  bankDifferenceOf: null,
  recurringPayment: null,
  ...overrides,
});

describe('turning a movement into income or expense', () => {
  it('only takes plain expenses and income', () => {
    expect(directionBlockOf(movement())).toBeNull();
    expect(
      directionBlockOf(movement({ type: TransactionType.adjustment })),
    ).toBe('type');
    expect(directionBlockOf(movement({ transferFrom: { id: 't' } }))).toBe(
      'transfer',
    );
    expect(directionBlockOf(movement({ debtPurchase: { id: 'd' } }))).toBe(
      'loan',
    );
    expect(directionBlockOf(movement({ cancelledAt: new Date() }))).toBe(
      'cancelled',
    );
    expect(oppositeOf(TransactionType.expense)).toBe(TransactionType.income);
  });

  it('flips the effect, moves the balance twice the amount and drops a category of the other kind', async () => {
    const tx = mockDeep<Prisma.TransactionClient>();
    const change = await turnMovement(tx, movement(), TransactionType.income, {
      categoryKind: 'expense',
    });
    expect(change).toBe(500);
    expect(tx.account.update).toHaveBeenCalledWith({
      where: { id: 'acc' },
      data: { balanceCurrent: { increment: 500 } },
    });
    expect(tx.transaction.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: {
        type: TransactionType.income,
        balanceEffect: 250,
        categoryId: null,
        categorySource: null,
      },
    });
  });

  it('a pending movement changes without touching the balance', async () => {
    const tx = mockDeep<Prisma.TransactionClient>();
    const change = await turnMovement(
      tx,
      movement({ isPending: true }),
      TransactionType.income,
    );
    expect(change).toBe(0);
    expect(tx.account.update).not.toHaveBeenCalled();
  });
});
