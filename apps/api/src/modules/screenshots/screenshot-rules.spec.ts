import { BANAMEX_SCREENSHOT as fixture } from './banamex-screenshot.fixture';
import { linesForAi, sanitizeAiScreenshot } from './screenshot-ai';
import {
  extractScreenshot,
  shotDate,
  type ShotOcrLine,
} from './screenshot-rules';

const today = new Date('2026-11-03T00:00:00.000Z');
const row = (text: string, y: number, confidence = 0.99): ShotOcrLine => ({
  text,
  confidence,
  box: [
    [140, y],
    [600, y],
    [600, y + 30],
    [140, y + 30],
  ],
});

describe('screenshot rules', () => {
  it('reads the Banamex movement list (real OCR output)', () => {
    const shot = extractScreenshot({
      lines: fixture.lines,
      today,
    });
    expect(shot.accountHint).toBe('Clásica Banamex **482');
    expect(shot.last4).toBe('482');
    expect(
      shot.movements.map((m) => [m.merchant, m.amount, m.date, m.inProcess]),
    ).toEqual([
      ['Netflix', 299, '2026-11-02', true],
      ['Netflix', 199, '2026-11-02', true],
      ['Netflix', 149, '2026-11-02', true],
      ['SMARTFIT', 499, '2026-11-02', true],
      ['Oxxo', 87.5, '2026-11-01', true],
      ['FARMACIA SAN PABLO', 342.1, '2026-11-01', true],
      ['Amazon', 1250, '2026-11-01', true],
      ['Dïdi', 64.3, null, false],
    ]);
    expect(shot.movements.every((m) => m.direction === 'out')).toBe(true);
    // Only the last row (cut off: no date) needs checking.
    expect(shot.movements.map((m) => m.review)).toEqual([
      [],
      [],
      [],
      [],
      [],
      [],
      [],
      ['date'],
    ]);
  });

  it('ignores headings and counts, and flags what was read poorly', () => {
    const shot = extractScreenshot({
      lines: [
        row('Tus movimientos', 100),
        row('60 movimientos', 150),
        row('SU ABONO GRACIAS +$2,500.00', 200),
        row('28 Oct', 240),
        row('OXX0 C0NDESA $45.50', 300, 0.6),
        row('31 Oct Aplicado', 340, 0.6),
        row('VETERINARIA $500', 400),
        row('30 Oct', 440),
      ],
      today,
    });
    expect(shot.last4).toBeNull();
    expect(shot.movements).toEqual([
      {
        date: '2026-10-28',
        merchant: 'SU ABONO GRACIAS',
        amount: 2500,
        direction: 'in',
        inProcess: false,
        review: [],
      },
      {
        date: '2026-10-31',
        merchant: 'OXX0 C0NDESA',
        amount: 45.5,
        direction: 'out',
        inProcess: false,
        review: ['merchant', 'amount', 'date'],
      },
      {
        date: '2026-10-30',
        merchant: 'VETERINARIA',
        amount: 500,
        direction: 'out',
        inProcess: false,
        review: [],
      },
    ]);
  });

  it('a day later in the year than today is from last year', () => {
    expect(shotDate('02', 'Nov', today)).toBe('2026-11-02');
    expect(shotDate('15', 'Dic', today)).toBe('2025-12-15');
    expect(shotDate('31', 'Xyz', today)).toBeNull();
  });
});

describe('screenshot AI fallback (sanitizing)', () => {
  it('keeps only plausible movements and flags what is missing', () => {
    const shot = sanitizeAiScreenshot(
      {
        account: '  Clásica   Banamex **482 ',
        last4: '482',
        movements: [
          {
            merchant: 'Netflix',
            amount: 299,
            date: '2026-11-02',
            inProcess: true,
          },
          { merchant: 'Futuro', amount: 10, date: '2027-01-01' },
          { amount: -5 },
          { merchant: 'Abono', amount: 100.456, direction: 'in' },
        ],
      },
      today,
    );
    expect(shot.accountHint).toBe('Clásica Banamex **482');
    expect(shot.last4).toBe('482');
    expect(shot.movements).toEqual([
      {
        date: '2026-11-02',
        merchant: 'Netflix',
        amount: 299,
        direction: 'out',
        inProcess: true,
        review: [],
      },
      {
        date: null,
        merchant: 'Futuro',
        amount: 10,
        direction: 'out',
        inProcess: false,
        review: ['date'],
      },
      {
        date: null,
        merchant: 'Abono',
        amount: 100.46,
        direction: 'in',
        inProcess: false,
        review: ['date'],
      },
    ]);
    expect(linesForAi([row('B', 50), row('A', 10)])).toBe('10 | A\n50 | B');
  });
});
