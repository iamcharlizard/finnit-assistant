import {
  RecurringExpenseKind,
  RecurringFrequency,
  TransactionSource,
} from '@finnit/database';
import {
  SuggestionTransaction,
  detectRecurring,
  isInstallmentText,
  normalizeMerchant,
  onSameMonthDay,
  suggestionFingerprint,
} from './detect';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const today = d('2026-10-13');
const userId = 'user-1';

let seq = 0;
const tx = (
  date: string,
  amount: number,
  merchant: string,
  overrides: Partial<SuggestionTransaction> = {},
): SuggestionTransaction => ({
  id: `t${++seq}`,
  date: d(date),
  amount,
  currency: 'MXN',
  accountId: 'card-1',
  categoryId: null,
  merchantName: merchant,
  description: null,
  source: TransactionSource.imported,
  ...overrides,
});

const series = (dates: string[], amount: number | number[], merchant: string) =>
  dates.map((date, i) =>
    tx(date, Array.isArray(amount) ? amount[i] : amount, merchant),
  );

const detect = (
  transactions: SuggestionTransaction[],
  existing: { name: string; merchantPattern: string | null }[] = [],
) => detectRecurring(transactions, { userId, today, existing });

describe('normalizeMerchant', () => {
  it.each([
    ['KSK*VID ONLYFANS FPA 231020BF8MX', 'KSK VID ONLYFANS'],
    ['KSK*VID ONLYFANSFPA 231020BF8MX', 'KSK VID ONLYFANS'],
    ['WAL MART TONALANWM 9709244W4', 'WAL MART TONALA'],
    ['LOMA VETE IITJ960612L18MX', 'LOMA VETE'],
    ['PAYU *GOOGLE CLOUD GCM 221031837', 'PAYU GOOGLE CLOUD'],
    ['FARM GUADALAJARA 20 FGU 830930PD3', 'FARM GUADALAJARA'],
    ['Café Ñandú #1234', 'CAFE NANDU'],
    ['NETFLIX.COM  ref 99812', 'NETFLIX COM REF'],
    ['AMAZON A MESES ANE 14(004:012)', 'AMAZON A MESES ANE'],
  ])('%s → %s', (raw, expected) => {
    expect(normalizeMerchant(raw)).toBe(expected);
  });
});

describe('isInstallmentText', () => {
  it.each([
    'AMAZON A MESES ANE 14(004:012)',
    'AMAZON A MESESANE 14(005:012)',
    'LIVERPOOL 007 DE 012',
    'COPPEL MSI',
    'Compra a meses sin intereses',
  ])('detects %s', (text) => {
    expect(isInstallmentText(text)).toBe(true);
  });

  it('ignores regular charges', () => {
    expect(isInstallmentText('NETFLIX.COM')).toBe(false);
    expect(isInstallmentText('DE LA ROSA 12')).toBe(false);
  });
});

describe('suggestionFingerprint', () => {
  it('is a stable url-safe hash per user, merchant and currency', () => {
    const a = suggestionFingerprint(userId, 'NETFLIX', 'MXN');
    expect(a).toMatch(/^[a-f0-9]{40}$/);
    expect(suggestionFingerprint(userId, 'NETFLIX', 'mxn')).toBe(a);
    expect(suggestionFingerprint('user-2', 'NETFLIX', 'MXN')).not.toBe(a);
    expect(suggestionFingerprint(userId, 'NETFLIX', 'USD')).not.toBe(a);
    expect(suggestionFingerprint(userId, 'NETFLIX', 'MXN', 31)).not.toBe(a);
  });
});

describe('detectRecurring', () => {
  it('never suggests a next due date before today', () => {
    // Charged on the 12th; "today" is the 13th and October's charge is in.
    const [s] = detect(
      series(['2026-08-12', '2026-09-12', '2026-10-12'], 115, 'SPOTIFY'),
    );
    expect(s.nextDueDate).toEqual(d('2026-11-12'));

    // October's charge is late (last one on Sep 11): the next is Nov 11.
    const [late] = detect(
      series(['2026-07-11', '2026-08-11', '2026-09-11'], 115, 'SPOTIFY'),
    );
    expect(late.nextDueDate).toEqual(d('2026-11-11'));
  });

  it('detects a monthly subscription', () => {
    const [s, ...rest] = detect(
      series(
        ['2026-07-10', '2026-08-10', '2026-09-10', '2026-10-10'],
        299,
        'NETFLIX.COM',
      ),
    );
    expect(rest).toHaveLength(0);
    expect(s).toMatchObject({
      merchant: 'NETFLIX COM',
      frequency: RecurringFrequency.monthly,
      interval: 1,
      amount: 299,
      isVariableAmount: false,
      kind: RecurringExpenseKind.subscription,
      currency: 'MXN',
      accountId: 'card-1',
      nextDueDate: d('2026-11-10'),
      fingerprint: suggestionFingerprint(userId, 'NETFLIXCOM', 'MXN'),
    });
    expect(s.occurrences.map((o) => o.date)).toEqual([
      d('2026-10-10'),
      d('2026-09-10'),
      d('2026-08-10'),
      d('2026-07-10'),
    ]);
    expect(s.confidence).toBeGreaterThan(0.8);
    expect(s.confidence).toBeLessThanOrEqual(1);
  });

  it('accepts monthly charges that drift a few days (28–33)', () => {
    const [s] = detect(
      series(
        ['2026-06-01', '2026-06-29', '2026-08-01', '2026-08-31', '2026-10-01'],
        149,
        'SPOTIFY',
      ),
    );
    expect(s.frequency).toBe(RecurringFrequency.monthly);
  });

  it.each([
    [
      RecurringFrequency.weekly,
      ['2026-09-15', '2026-09-22', '2026-09-29', '2026-10-06', '2026-10-13'],
      '2026-10-20',
    ],
    [
      RecurringFrequency.biweekly,
      [
        '2026-07-23',
        '2026-08-06',
        '2026-08-20',
        '2026-09-03',
        '2026-09-17',
        '2026-10-01',
      ],
      '2026-10-15',
    ],
    [
      RecurringFrequency.semimonthly,
      [
        '2026-07-15',
        '2026-07-31',
        '2026-08-15',
        '2026-08-31',
        '2026-09-15',
        '2026-09-30',
      ],
      '2026-10-15',
    ],
    [
      RecurringFrequency.bimonthly,
      ['2026-02-20', '2026-04-20', '2026-06-20', '2026-08-20'],
      '2026-10-20',
    ],
    [
      RecurringFrequency.quarterly,
      ['2026-01-05', '2026-04-05', '2026-07-05', '2026-10-05'],
      '2027-01-05',
    ],
    [RecurringFrequency.semiannual, ['2026-04-01', '2026-10-01'], '2027-04-01'],
    [RecurringFrequency.yearly, ['2025-10-01', '2026-09-28'], '2027-09-28'],
  ])('detects %s', (frequency, dates, next) => {
    const [s] = detect(series(dates, 500, 'GYM SPORT CITY'));
    expect(s).toBeDefined();
    expect(s.frequency).toBe(frequency);
    expect(s.nextDueDate).toEqual(d(next));
  });

  it('needs 3 occurrences for weekly to semimonthly cadences', () => {
    expect(
      detect(series(['2026-10-06', '2026-10-13'], 120, 'GYM CLASS')),
    ).toEqual([]);
  });

  it('accepts a monthly charge seen twice only at a fixed amount', () => {
    const [twice] = detect(
      series(['2026-09-11', '2026-10-12'], 448, 'NETFLIX.COM'),
    );
    expect(twice).toMatchObject({
      frequency: RecurringFrequency.monthly,
      amount: 448,
      nextDueDate: d('2026-11-12'),
    });
    const [fourTimes] = detect(
      series(
        ['2026-07-11', '2026-08-11', '2026-09-11', '2026-10-12'],
        448,
        'NETFLIX.COM',
      ),
    );
    expect(twice.confidence).toBeLessThan(fourTimes.confidence);

    // Twice, a different amount and 4 days apart in the month: not enough.
    expect(
      detect(series(['2026-08-10', '2026-09-14'], [250, 389], 'TELMEX')),
    ).toEqual([]);
  });

  it('accepts two charges on the same day of the month (± 1), even if the amount varies', () => {
    const [sameDay] = detect(
      series(['2026-08-12', '2026-09-12'], [250, 360], 'CFE SUMINISTRADOR'),
    );
    expect(sameDay).toMatchObject({
      frequency: RecurringFrequency.monthly,
      isVariableAmount: true,
    });

    const [oneDayApart] = detect(
      series(['2026-08-29', '2026-09-30'], [250, 389], 'TELMEX'),
    );
    expect(oneDayApart).toMatchObject({
      frequency: RecurringFrequency.monthly,
      isVariableAmount: true,
    });

    // Month ends count as the same day (Aug 31, Sep 28 → 28 days apart).
    const [monthEnd] = detect(series(['2026-08-31', '2026-09-28'], 199, 'GYM'));
    expect(monthEnd.frequency).toBe(RecurringFrequency.monthly);
  });

  it('onSameMonthDay compares days of the month with month ends as the 28th', () => {
    expect(onSameMonthDay([d('2026-08-10'), d('2026-09-11')])).toBe(true);
    expect(onSameMonthDay([d('2026-08-10'), d('2026-09-12')])).toBe(false);
    expect(onSameMonthDay([d('2026-01-31'), d('2026-02-28')])).toBe(true);
  });

  it('skips stale subscriptions', () => {
    expect(
      detect(
        series(
          ['2026-03-10', '2026-04-10', '2026-05-10', '2026-06-10'],
          299,
          'NETFLIX',
        ),
      ),
    ).toEqual([]);
  });

  it('skips irregular charges', () => {
    expect(
      detect(
        series(
          [
            '2026-06-02',
            '2026-06-20',
            '2026-07-30',
            '2026-08-04',
            '2026-10-01',
          ],
          299,
          'TIENDA',
        ),
      ),
    ).toEqual([]);
  });

  it('needs 70% of the intervals to fit the cadence', () => {
    // A missed month: 2 of 3 intervals fit (67%).
    expect(
      detect(
        series(
          ['2026-05-10', '2026-06-10', '2026-08-10', '2026-09-10'],
          299,
          'NETFLIX',
        ),
      ),
    ).toEqual([]);
  });

  it('marks amounts that move more than 15% as variable', () => {
    const [s] = detect(
      series(
        ['2026-07-05', '2026-08-05', '2026-09-05', '2026-10-05'],
        [500, 600, 450, 700],
        'CFE SUMINISTRADOR',
      ),
    );
    expect(s.isVariableAmount).toBe(true);
    expect(s.amount).toBe(550);
    expect(s.kind).toBe(RecurringExpenseKind.other);
  });

  it('rejects amounts that move more than 50%', () => {
    expect(
      detect(
        series(
          ['2026-07-05', '2026-08-05', '2026-09-05', '2026-10-05'],
          [100, 300, 120, 500],
          'TIENDA',
        ),
      ),
    ).toEqual([]);
  });

  it('splits a merchant with several price points', () => {
    const dates = ['2026-07-03', '2026-08-03', '2026-09-03', '2026-10-03'];
    const suggestions = detect([
      ...series(dates, 39, 'APPLE.COM/BILL CUPERTINO CA'),
      ...series(dates, 529, 'APPLE.COM/BILLCUPERTINOCA'),
    ]);
    expect(suggestions.map((s) => s.amount).sort((a, b) => a - b)).toEqual([
      39, 529,
    ]);
    expect(new Set(suggestions.map((s) => s.fingerprint)).size).toBe(2);
    expect(suggestions.every((s) => s.occurrences.length === 4)).toBe(true);
  });

  it('finds a subscription among one-off purchases at the same merchant', () => {
    const suggestions = detect([
      ...series(
        ['2026-07-12', '2026-08-12', '2026-09-12', '2026-10-12'],
        99,
        'AMAZON',
      ),
      tx('2026-07-20', 1200, 'AMAZON'),
      tx('2026-08-02', 450, 'AMAZON'),
      tx('2026-09-25', 2300, 'AMAZON'),
    ]);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({ amount: 99, frequency: 'monthly' });
  });

  it('groups merchants printed with and without spaces', () => {
    const [s] = detect([
      tx('2026-08-03', 39, 'APPLE.COM/BILL CUPERTINO CA'),
      tx('2026-09-03', 39, 'APPLE.COM/BILLCUPERTINOCA'),
      tx('2026-10-03', 39, 'APPLE.COM/BILL CUPERTINO CA'),
    ]);
    expect(s.merchant).toBe('APPLE COM BILL CUPERTINO CA');
    expect(s.occurrences).toHaveLength(3);
  });

  it('uses the description when there is no merchant name', () => {
    const [s] = detect(
      ['2026-08-10', '2026-09-10', '2026-10-10'].map((date) =>
        tx(date, 199, '', {
          merchantName: null,
          description: 'HBO MAX HBM 120101AB1MX',
        }),
      ),
    );
    expect(s.merchant).toBe('HBO MAX');
  });

  it('separates currencies', () => {
    const dates = ['2026-08-10', '2026-09-10', '2026-10-10'];
    const suggestions = detect([
      ...series(dates, 10, 'OPENAI'),
      ...dates.map((date) => tx(date, 10, 'OPENAI', { currency: 'USD' })),
    ]);
    expect(suggestions.map((s) => s.currency).sort()).toEqual(['MXN', 'USD']);
  });

  it('excludes merchants that already have a recurring expense', () => {
    const dates = ['2026-08-10', '2026-09-10', '2026-10-10'];
    const transactions = [
      ...series(dates, 299, 'NETFLIX.COM'),
      ...series(dates, 129, 'SPOTIFY P1234'),
      ...series(dates, 79, 'YOUTUBE PREMIUM'),
    ];
    const suggestions = detect(transactions, [
      { name: 'Netflix', merchantPattern: null },
      { name: 'Música', merchantPattern: 'spotify' },
    ]);
    expect(suggestions.map((s) => s.merchant)).toEqual(['YOUTUBE PREMIUM']);
  });

  it('skips installment purchases', () => {
    expect(
      detect(
        ['2026-08-10', '2026-09-10', '2026-10-10'].map((date, i) =>
          tx(date, 52.97, `AMAZON A MESES ANE 14(00${i + 4}:012)`),
        ),
      ),
    ).toEqual([]);
  });

  it('counts two charges on the same day once for the cadence', () => {
    const [s] = detect([
      ...series(['2026-08-10', '2026-09-10', '2026-10-10'], 299, 'NETFLIX'),
      tx('2026-10-10', 299, 'NETFLIX'),
    ]);
    expect(s.frequency).toBe(RecurringFrequency.monthly);
    expect(s.occurrences).toHaveLength(4);
  });

  it('picks the most common account and category', () => {
    const [s] = detect([
      tx('2026-08-10', 299, 'NETFLIX', { accountId: 'a', categoryId: 'x' }),
      tx('2026-09-10', 299, 'NETFLIX', { accountId: 'b', categoryId: 'y' }),
      tx('2026-10-10', 299, 'NETFLIX', { accountId: 'b', categoryId: 'y' }),
    ]);
    expect(s).toMatchObject({ accountId: 'b', categoryId: 'y' });
  });

  it('ignores transactions older than 13 months', () => {
    expect(detect(series(['2025-01-10', '2026-01-10'], 999, 'SEGURO'))).toEqual(
      [],
    );
  });

  it('ranks steadier groups first', () => {
    const suggestions = detect([
      ...series(
        [
          '2026-05-05',
          '2026-06-05',
          '2026-07-05',
          '2026-08-05',
          '2026-09-05',
          '2026-10-05',
        ],
        299,
        'NETFLIX',
      ),
      ...series(
        ['2026-08-07', '2026-09-07', '2026-10-07'],
        [400, 500, 600],
        'CFE',
      ),
    ]);
    expect(suggestions.map((s) => s.merchant)).toEqual(['NETFLIX', 'CFE']);
    expect(suggestions[0].confidence).toBeGreaterThan(
      suggestions[1].confidence,
    );
  });
});
