import { addDays, localToday, toLocalDateOnly } from './local-date.util';

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('toLocalDateOnly', () => {
  it('keeps a date-only string as that day', () => {
    expect(toLocalDateOnly('2026-10-13')).toEqual(day('2026-10-13'));
  });

  it('keeps a Date at midnight UTC (what the DateTime scalar makes of "2026-10-13")', () => {
    expect(toLocalDateOnly(new Date('2026-10-13'))).toEqual(day('2026-10-13'));
  });

  it('uses the Mexico City day for a full timestamp', () => {
    // 2026-10-14T04:30Z is Oct 13, 22:30 in Mexico City.
    expect(toLocalDateOnly(new Date('2026-10-14T04:30:00Z'))).toEqual(
      day('2026-10-13'),
    );
    expect(toLocalDateOnly('2026-10-14T04:30:00Z')).toEqual(day('2026-10-13'));
  });

  it('keeps a midday timestamp on its day', () => {
    expect(toLocalDateOnly('2026-10-13T18:00:00Z')).toEqual(day('2026-10-13'));
  });

  it('honours timestamps with an offset', () => {
    expect(toLocalDateOnly('2026-10-13T23:59:00-06:00')).toEqual(
      day('2026-10-13'),
    );
  });

  it('accepts another time zone', () => {
    expect(toLocalDateOnly('2026-10-14T04:30:00Z', 'Europe/Madrid')).toEqual(
      day('2026-10-14'),
    );
  });

  it('rejects an invalid date', () => {
    expect(() => toLocalDateOnly('not a date')).toThrow(RangeError);
  });
});

describe('localToday', () => {
  it('is the current Mexico City day, even at midnight UTC', () => {
    expect(localToday(undefined, new Date('2026-10-14T00:00:00Z'))).toEqual(
      day('2026-10-13'),
    );
    expect(localToday(undefined, new Date('2026-10-14T07:00:00Z'))).toEqual(
      day('2026-10-14'),
    );
  });
});

describe('addDays', () => {
  it('moves across months', () => {
    expect(addDays(day('2026-10-30'), 3)).toEqual(day('2026-11-02'));
    expect(addDays(day('2026-10-02'), -3)).toEqual(day('2026-09-29'));
  });
});
