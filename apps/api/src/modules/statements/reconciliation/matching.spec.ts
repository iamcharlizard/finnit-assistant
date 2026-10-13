import { ImportedLineKind, TransactionType } from '@finnit/database';
import {
  CandidateOccurrence,
  CandidateTransaction,
  LineToMatch,
  matchOccurrences,
  matchTransactions,
} from './matching';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const line = (overrides: Partial<LineToMatch> = {}): LineToMatch => ({
  id: 'line-1',
  date: d('2026-09-10'),
  amount: 299,
  kind: ImportedLineKind.charge,
  description: 'NETFLIX.COM MEXICO',
  merchant: null,
  ...overrides,
});

const txn = (
  overrides: Partial<CandidateTransaction> = {},
): CandidateTransaction => ({
  id: 'txn-1',
  type: TransactionType.expense,
  amount: 299,
  txnDate: d('2026-09-10'),
  merchantName: 'Netflix',
  description: null,
  ...overrides,
});

const occurrence = (
  overrides: Partial<CandidateOccurrence> = {},
): CandidateOccurrence => ({
  id: 'occ-1',
  dueDate: d('2026-09-08'),
  expectedAmount: 299,
  expenseName: 'Netflix',
  merchantPattern: 'NETFLIX',
  isVariableAmount: false,
  ...overrides,
});

describe('matchTransactions', () => {
  it('matches the same amount within three days', () => {
    expect(
      matchTransactions([line()], [txn({ txnDate: d('2026-09-12') })]),
    ).toEqual(new Map([['line-1', 'txn-1']]));
  });

  it('ignores different amounts, far dates and the wrong direction', () => {
    const candidates = [
      txn({ id: 'a', amount: 300 }),
      txn({ id: 'b', txnDate: d('2026-09-14') }),
      txn({ id: 'c', type: TransactionType.income }),
    ];
    expect(matchTransactions([line()], candidates).size).toBe(0);
  });

  it('matches payments to income, transfers or adjustments', () => {
    const payment = line({ kind: ImportedLineKind.payment, amount: 5000 });
    expect(
      matchTransactions(
        [payment],
        [txn({ type: TransactionType.transfer, amount: 5000 })],
      ).get('line-1'),
    ).toBe('txn-1');
  });

  it('uses each transaction once and prefers the closest date', () => {
    const lines = [
      line({ id: 'l1', date: d('2026-09-10') }),
      line({ id: 'l2', date: d('2026-09-11') }),
    ];
    const candidates = [
      txn({ id: 'near', txnDate: d('2026-09-10') }),
      txn({ id: 'far', txnDate: d('2026-09-12') }),
    ];
    expect(matchTransactions(lines, candidates)).toEqual(
      new Map([
        ['l1', 'near'],
        ['l2', 'far'],
      ]),
    );
  });

  it('breaks date ties by merchant similarity', () => {
    const candidates = [
      txn({ id: 'oxxo', merchantName: 'OXXO' }),
      txn({ id: 'netflix', merchantName: 'Netflix' }),
    ];
    expect(matchTransactions([line()], candidates).get('line-1')).toBe(
      'netflix',
    );
  });
});

describe('matchOccurrences', () => {
  it('matches by merchant pattern within the date window', () => {
    expect(matchOccurrences([line()], [occurrence()])).toEqual(
      new Map([['line-1', 'occ-1']]),
    );
  });

  it('tolerates a price change of a fixed subscription up to 15%', () => {
    expect(matchOccurrences([line({ amount: 329 })], [occurrence()]).size).toBe(
      1,
    );
    expect(matchOccurrences([line({ amount: 399 })], [occurrence()]).size).toBe(
      0,
    );
  });

  it('accepts wider ranges for variable bills', () => {
    const bill = occurrence({
      expenseName: 'Luz',
      merchantPattern: 'CFE',
      expectedAmount: 800,
      isVariableAmount: true,
    });
    expect(
      matchOccurrences(
        [line({ description: 'CFE SUMINISTRADOR', amount: 1100 })],
        [bill],
      ).size,
    ).toBe(1);
  });

  it('falls back to the expense name without a pattern', () => {
    expect(
      matchOccurrences([line()], [occurrence({ merchantPattern: null })]).size,
    ).toBe(1);
    expect(
      matchOccurrences(
        [line({ description: 'SPOTIFY' })],
        [occurrence({ merchantPattern: null })],
      ).size,
    ).toBe(0);
  });

  it('skips payments and occurrences outside the window', () => {
    expect(
      matchOccurrences(
        [line({ kind: ImportedLineKind.payment })],
        [occurrence()],
      ).size,
    ).toBe(0);
    expect(
      matchOccurrences([line()], [occurrence({ dueDate: d('2026-08-25') })])
        .size,
    ).toBe(0);
  });

  it('assigns each occurrence once, to the closest charge', () => {
    const lines = [
      line({ id: 'l1', date: d('2026-09-02') }),
      line({ id: 'l2', date: d('2026-09-09') }),
    ];
    expect(matchOccurrences(lines, [occurrence()])).toEqual(
      new Map([['l1', 'occ-1']]),
    );
  });
});
