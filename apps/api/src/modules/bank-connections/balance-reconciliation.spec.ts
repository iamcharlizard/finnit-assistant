import { mismatchTexts, reconcileBalance } from './balance-reconciliation';

describe('balance reconciliation', () => {
  it('nothing open when the recorded movements explain the bank', () => {
    expect(
      reconcileBalance({
        bankBalance: 800,
        reconciledBalance: 1000,
        recordedSince: -200,
        openDifference: 0,
      }),
    ).toEqual({ expected: 800, openDifference: 0 });
  });

  it('keeps what is missing as the open difference', () => {
    // A 150 charge the bank has but nobody recorded.
    expect(
      reconcileBalance({
        bankBalance: 650,
        reconciledBalance: 1000,
        recordedSince: -200,
        openDifference: 0,
      }).openDifference,
    ).toBe(-150);
  });

  it('closes the difference once the missing movement is recorded', () => {
    expect(
      reconcileBalance({
        bankBalance: 650,
        reconciledBalance: 650,
        recordedSince: -150, // recorded later, dated earlier
        openDifference: -150,
      }).openDifference,
    ).toBe(0);
  });

  it('grows or shrinks with what happens in between, ignoring cents', () => {
    expect(
      reconcileBalance({
        bankBalance: 600,
        reconciledBalance: 650,
        recordedSince: 0,
        openDifference: -150,
      }).openDifference,
    ).toBe(-200);
    expect(
      reconcileBalance({
        bankBalance: 100.4,
        reconciledBalance: 100,
        recordedSince: 0,
        openDifference: 0,
      }).openDifference,
    ).toBe(0);
  });

  it('writes the notification in the user language', () => {
    const es = mismatchTexts('es', {
      account: 'Mi Cuenta',
      difference: -1500,
      currency: 'MXN',
    });
    expect(es.title).toBe('Mi Cuenta: el saldo no coincide con el banco');
    expect(es.message).toContain('1,500.00 MXN menos');
    expect(es.adjustment).toBe('Diferencia con el banco');
    expect(
      mismatchTexts('en', { account: 'A', difference: 20, currency: 'USD' })
        .message,
    ).toContain('20.00 USD more');
  });
});
