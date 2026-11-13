import { checkCancellation } from './cancellation';
import { statusWhere } from './transactions.service';
import { TransactionStatus } from './dto/transaction.dto';
import {
  cancelBlockOf,
  type CancellableMovement,
} from '../../common/utils/cancel-movement.util';

describe('checkCancellation', () => {
  const movement = { id: 't-1', amount: 1_250 };

  it('has nothing to say without a confirmed statement', () => {
    expect(checkCancellation(movement, null)).toEqual({
      statementDate: null,
      appears: null,
      reversalFound: false,
    });
  });

  it('tells whether the statement lists it and shows its reversal', () => {
    const statement = {
      closedOn: '2026-10-28',
      lines: [
        { matchedTransactionId: 't-1', credit: false, amount: 1_250 },
        { matchedTransactionId: null, credit: true, amount: 1_250 },
      ],
    };
    expect(checkCancellation(movement, statement)).toEqual({
      statementDate: '2026-10-28',
      appears: true,
      reversalFound: true,
    });
    expect(
      checkCancellation(movement, {
        closedOn: '2026-10-28',
        lines: [{ matchedTransactionId: 'other', credit: false, amount: 90 }],
      }),
    ).toEqual({
      statementDate: '2026-10-28',
      appears: false,
      reversalFound: false,
    });
  });
});

describe('statusWhere', () => {
  it('builds one condition per state, nothing for an empty list', () => {
    expect(
      statusWhere([TransactionStatus.completed, TransactionStatus.cancelled]),
    ).toEqual([
      { isPending: false, cancelledAt: null },
      { cancelledAt: { not: null } },
    ]);
    expect(statusWhere([])).toEqual([{ id: { in: [] } }]);
  });
});

describe('cancelBlockOf', () => {
  const base = {
    id: 't',
    accountId: 'card',
    type: 'expense',
    cancelledAt: null,
    transferFrom: null,
    transferTo: null,
    debtPayment: null,
    debtCharge: null,
    debtDisbursement: null,
    bankDifferenceOf: null,
    debtPurchase: null,
    recurringPayment: null,
  } as unknown as CancellableMovement;

  it('lets a plain movement be cancelled', () => {
    expect(cancelBlockOf(base)).toBeNull();
    // A subscription it paid reopens; a loan installment does not allow it.
    expect(
      cancelBlockOf({
        ...base,
        recurringPayment: {
          id: 'o',
          recurringExpense: { debtId: null, kind: 'subscription' },
        },
      }),
    ).toBeNull();
  });

  it('refuses transfers, loans, adjustments and cancelled ones', () => {
    expect(cancelBlockOf({ ...base, transferFrom: { id: 'tr' } })).toBe(
      'transfer',
    );
    expect(cancelBlockOf({ ...base, debtPurchase: { id: 'd' } })).toBe('loan');
    expect(
      cancelBlockOf({
        ...base,
        recurringPayment: {
          id: 'o',
          recurringExpense: { debtId: 'd', kind: 'installment' },
        },
      } as never),
    ).toBe('loan');
    expect(cancelBlockOf({ ...base, type: 'adjustment' } as never)).toBe(
      'adjustment',
    );
    expect(cancelBlockOf({ ...base, cancelledAt: new Date() })).toBe(
      'cancelled',
    );
  });
});
