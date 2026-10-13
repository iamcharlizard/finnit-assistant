import { AccountType, ImportedLineKind } from '@finnit/database';
import { SyncfyTransaction } from './syncfy.client';
import {
  mapTransaction,
  maskNumber,
  operationDate,
  suggestedAccountType,
  toNumber,
} from './syncfy.mapper';

// 2026-09-11 00:00 UTC; dt_transaction is the same day at 00:00 in Mexico City.
const OPERATION = Date.UTC(2026, 8, 11) / 1000;
const tx = (overrides: Partial<SyncfyTransaction> = {}): SyncfyTransaction => ({
  id_transaction: 'tx-1',
  id_account: 'acc-1',
  description: 'NETFLIX COM 1 NME 110513PI3',
  amount: -448,
  currency: 'MXN',
  dt_transaction: OPERATION + 6 * 3600,
  extra: {
    dt_operation: OPERATION,
    dt_application: OPERATION + 3 * 86400,
  },
  ...overrides,
});
const card = { account_type: 'Credit Card', currency: 'MXN' };
const checking = { account_type: 'Checking', currency: 'MXN' };

describe('syncfy.mapper', () => {
  it('maps a card charge with its operation and posting dates', () => {
    expect(mapTransaction(tx(), card)).toEqual({
      providerTxnId: 'tx-1',
      date: new Date('2026-09-11T00:00:00.000Z'),
      postDate: new Date('2026-09-14T00:00:00.000Z'),
      description: 'NETFLIX COM 1 NME 110513PI3',
      merchant: 'NETFLIX COM 1',
      amount: 448,
      kind: ImportedLineKind.charge,
      installmentNumber: undefined,
      installmentTotal: undefined,
      currency: 'MXN',
    });
  });

  it('uses dt_transaction when there is no operation date', () => {
    expect(operationDate(tx({ extra: null })).toISOString()).toBe(
      '2026-09-11T00:00:00.000Z',
    );
  });

  it('strips the leading bank reference', () => {
    const line = mapTransaction(
      tx({ description: '123456789 WAL MART TONALA NWM 9709244W4' }),
      card,
    );
    expect(line.description).toBe('WAL MART TONALA NWM 9709244W4');
    expect(line.merchant).toBe('WAL MART TONALA');
  });

  it.each([
    ['AMAZON A MESES (007:012)', 7, 12],
    ['HDI WEBSERVICE 006 de 012', 6, 12],
  ])('reads installments from %p', (description, number, total) => {
    const line = mapTransaction(tx({ description, amount: -1108.25 }), card);
    expect(line).toEqual(
      expect.objectContaining({
        kind: ImportedLineKind.installment,
        installmentNumber: number,
        installmentTotal: total,
      }),
    );
  });

  it('classifies money in on a card as payment or refund', () => {
    expect(
      mapTransaction(
        tx({ description: 'SU ABONO...GRACIAS', amount: 5000 }),
        card,
      ).kind,
    ).toBe(ImportedLineKind.payment);
    expect(
      mapTransaction(
        tx({ description: 'AMAZON ANE 140618P37MX', amount: 790.89 }),
        card,
      ).kind,
    ).toBe(ImportedLineKind.refund);
  });

  it('classifies money in on a debit account as a deposit', () => {
    expect(
      mapTransaction(
        tx({ description: 'SPEI RECIBIDO', amount: 2500 }),
        checking,
      ).kind,
    ).toBe(ImportedLineKind.deposit);
  });

  it('detects interest and fees', () => {
    expect(
      mapTransaction(tx({ description: 'INTERESES ORDINARIOS' }), card).kind,
    ).toBe(ImportedLineKind.interest);
    expect(
      mapTransaction(tx({ description: 'COMISION ANUALIDAD' }), card).kind,
    ).toBe(ImportedLineKind.fee);
  });

  it('keeps only the last 4 digits of account numbers', () => {
    expect(maskNumber('5188 9991 1040 1037')).toBe('1037');
    expect(maskNumber('12')).toBeUndefined();
    expect(maskNumber(null)).toBeUndefined();
  });

  it('suggests the Finnit account type', () => {
    const base = { id_account: 'a', id_credential: 'c' };
    expect(suggestedAccountType({ ...base, account_type: 'Credit Card' })).toBe(
      AccountType.credit,
    );
    expect(suggestedAccountType({ ...base, account_type: 'Savings' })).toBe(
      AccountType.savings,
    );
    expect(suggestedAccountType({ ...base, account_type: 'Checking' })).toBe(
      AccountType.debit,
    );
  });

  it('parses numeric strings', () => {
    expect(toNumber('77000')).toBe(77000);
    expect(toNumber('n/a')).toBeUndefined();
    expect(toNumber(null)).toBeUndefined();
  });
});
