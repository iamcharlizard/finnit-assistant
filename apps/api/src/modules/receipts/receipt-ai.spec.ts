import { sanitizeAiReceipt } from './receipt-ai';

const today = new Date('2026-10-13T00:00:00.000Z');

describe('sanitizeAiReceipt', () => {
  it('keeps well-formed, plausible fields', () => {
    expect(
      sanitizeAiReceipt(
        {
          total: 120.456,
          date: '2026-10-10',
          merchantName: '  Cafe   Demo ',
          taxId: 'dem0101012x3',
        },
        today,
      ),
    ).toEqual({
      total: 120.46,
      date: '2026-10-10',
      merchantName: 'Cafe Demo',
      taxId: 'DEM0101012X3',
    });
  });

  it('drops invented or malformed values', () => {
    expect(
      sanitizeAiReceipt(
        {
          total: -3,
          date: '2026-10-14', // future
          merchantName: 5,
          taxId: 'XAXX010101000',
        },
        today,
      ),
    ).toEqual({});
    expect(
      sanitizeAiReceipt({ total: '12', date: '2026-02-30' }, today),
    ).toEqual({});
    expect(sanitizeAiReceipt(null, today)).toEqual({});
  });
});
