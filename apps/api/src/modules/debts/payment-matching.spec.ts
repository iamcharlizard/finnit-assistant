import { lenderWords, matchLoanPayments } from './payment-matching';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const open = [
  { id: 'oct', dueDate: d('2026-10-15'), expectedAmount: 1_500 },
  { id: 'nov', dueDate: d('2026-11-15'), expectedAmount: 1_500 },
];
const ctx = {
  variable: false,
  names: ['Préstamo Kubo', 'Kubo Financiero'],
  knownKeys: new Set<string>(),
};

describe('payment-matching', () => {
  it('keeps the distinctive words of the loan names', () => {
    expect(lenderWords(['Préstamo YoTePresto', 'Banco Azteca'])).toEqual([
      'YOTEPRESTO',
      'AZTECA',
    ]);
  });

  it('matches by amount and date, preferring the movement that names the lender', () => {
    const matches = matchLoanPayments(
      open,
      [
        { id: 'a', date: d('2026-10-15'), amount: 1_500, text: 'OXXO' },
        { id: 'b', date: d('2026-10-16'), amount: 1_500, text: 'PAGO KUBO' },
      ],
      ctx,
    );
    expect(matches).toEqual([
      expect.objectContaining({
        occurrenceId: 'oct',
        transactionId: 'b',
        reason: 'text',
        ambiguous: false,
      }),
    ]);
  });

  it('prefers the merchant that already paid the loan', () => {
    const matches = matchLoanPayments(
      open,
      [
        {
          id: 'a',
          date: d('2026-10-14'),
          amount: 1_500,
          text: 'SPEI ENVIADO 123',
        },
        { id: 'b', date: d('2026-10-15'), amount: 1_500, text: 'CARGO VARIOS' },
      ],
      { ...ctx, names: [], knownKeys: new Set(['SPEIENVIADO']) },
    );
    expect(matches[0]).toEqual(
      expect.objectContaining({ transactionId: 'a', reason: 'history' }),
    );
  });

  it('flags a tie between movements that only fit by amount', () => {
    const [match] = matchLoanPayments(
      open,
      [
        { id: 'a', date: d('2026-10-15'), amount: 1_500, text: 'CARGO 1' },
        { id: 'b', date: d('2026-10-15'), amount: 1_500, text: 'CARGO 2' },
      ],
      { ...ctx, names: [] },
    );
    expect(match.ambiguous).toBe(true);
    expect(match.alternatives).toHaveLength(1);
  });

  it('skips movements outside the amount or date window', () => {
    expect(
      matchLoanPayments(
        open,
        [
          { id: 'far', date: d('2026-10-30'), amount: 1_500, text: 'KUBO' },
          { id: 'big', date: d('2026-10-15'), amount: 2_000, text: 'KUBO' },
        ],
        ctx,
      ),
    ).toEqual([]);
    // A variable loan (purchase financing) accepts a wider amount.
    expect(
      matchLoanPayments(
        open,
        [{ id: 'big', date: d('2026-10-15'), amount: 2_000, text: 'KUBO' }],
        { ...ctx, variable: true },
      ),
    ).toHaveLength(1);
  });

  it('uses each movement and installment once', () => {
    const matches = matchLoanPayments(
      [
        { id: 'oct-15', dueDate: d('2026-10-15'), expectedAmount: 500 },
        { id: 'oct-31', dueDate: d('2026-10-31'), expectedAmount: 500 },
      ],
      [
        { id: 'a', date: d('2026-10-16'), amount: 500, text: 'KUESKI' },
        { id: 'b', date: d('2026-10-30'), amount: 500, text: 'KUESKI' },
      ],
      { ...ctx, names: ['Kueski'] },
    );
    expect(
      matches.map((m) => [m.occurrenceId, m.transactionId]).sort(),
    ).toEqual([
      ['oct-15', 'a'],
      ['oct-31', 'b'],
    ]);
  });
});
