import {
  namesMatch,
  rankExpenseCandidates,
  rankLoansForMovement,
  suggestedLoan,
  type LinkLoanInput,
} from './loan-links';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const none = new Set<string>();

const loan = (
  debtId: string,
  names: string[],
  targets: LinkLoanInput['targets'],
): LinkLoanInput => ({
  debtId,
  names,
  knownKeys: none,
  variable: false,
  targets,
});

describe('loan links', () => {
  it('matches the loan by its distinctive words, not generic ones', () => {
    expect(namesMatch('DIDI*PRESTAMOS 2 DPA', ['Préstamo DiDi'], none)).toBe(
      true,
    );
    expect(namesMatch('PAGO PRESTAMO SPEI', ['Préstamo DiDi'], none)).toBe(
      false,
    );
    expect(
      namesMatch('KUBO FINANCIERO', ['Otro'], new Set(['KUBOFINANCIERO'])),
    ).toBe(true);
  });

  it("suggests the payment due the movement's own day, then a close one", () => {
    const ranked = rankLoansForMovement(
      { day: d('2026-11-03'), amount: 990.19, text: 'DIDI*PRESTAMOS 2' },
      [
        loan(
          'azteca',
          ['Banco Azteca'],
          [
            {
              occurrenceId: 'a1',
              dueDate: d('2026-11-05'),
              amount: 990,
              state: 'open',
            },
          ],
        ),
        loan(
          'didi',
          ['DiDi'],
          [
            {
              occurrenceId: 'd0',
              dueDate: d('2026-10-03'),
              amount: 990.19,
              state: 'paid_without_movement',
            },
            {
              occurrenceId: 'd1',
              dueDate: d('2026-11-03'),
              amount: 990.19,
              state: 'open',
            },
          ],
        ),
        loan('empty', ['Vacío'], []),
      ],
    );
    expect(ranked.map((r) => r.debtId)).toEqual(['didi', 'azteca']);
    expect(ranked[0].suggestedOccurrenceId).toBe('d1');
    expect(ranked[1].suggestedOccurrenceId).toBe('a1');
    expect(suggestedLoan(ranked)?.debtId).toBe('didi');
  });

  it('suggests nothing when no payment fits and nothing names the loan', () => {
    const ranked = rankLoansForMovement(
      { day: d('2026-11-03'), amount: 300, text: 'OXXO' },
      [
        loan(
          'didi',
          ['DiDi'],
          [
            {
              occurrenceId: 'd1',
              dueDate: d('2026-12-03'),
              amount: 990.19,
              state: 'open',
            },
          ],
        ),
      ],
    );
    expect(ranked[0].suggestedOccurrenceId).toBeNull();
    expect(suggestedLoan(ranked)).toBeNull();
  });

  it('proposes movements close in amount and date, naming the loan first', () => {
    const ranked = rankExpenseCandidates(
      [
        { id: 'far', date: d('2026-12-20'), amount: 990.19, text: 'DIDI' },
        { id: 'oxxo', date: d('2026-11-03'), amount: 990.19, text: 'OXXO' },
        { id: 'didi', date: d('2026-11-05'), amount: 980, text: 'DIDI*PREST' },
        { id: 'small', date: d('2026-11-03'), amount: 500, text: 'DIDI' },
      ],
      {
        dueDate: d('2026-11-03'),
        expected: 990.19,
        variable: false,
        names: ['DiDi'],
        knownKeys: none,
        searching: false,
      },
    );
    expect(ranked.map((r) => r.id)).toEqual(['didi', 'oxxo']);
    expect(ranked[1].exactAmount).toBe(true);
    expect(ranked[0].exactAmount).toBe(false);
  });

  it('keeps every movement of a search, ranked the same way', () => {
    const ranked = rankExpenseCandidates(
      [
        { id: 'small', date: d('2026-11-03'), amount: 500, text: 'DIDI' },
        { id: 'far', date: d('2026-06-20'), amount: 990.19, text: 'DIDI' },
      ],
      {
        dueDate: d('2026-11-03'),
        expected: 990.19,
        variable: false,
        names: ['DiDi'],
        knownKeys: none,
        searching: true,
      },
    );
    expect(ranked.map((r) => r.id).sort()).toEqual(['far', 'small']);
  });
});
