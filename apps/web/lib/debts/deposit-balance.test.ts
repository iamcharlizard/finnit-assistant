import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  addsToBalanceByDefault,
  buildChargeInput,
  chargeFormOf,
  newChargeForm,
  validateChargeForm,
} from './charge-form';
import { buildLoanUpdate, loanEditFormOf } from './loan-edit';
import { buildLoanInput, newLoanForm } from './loan-form';
import type { ApiDebt, ApiDebtCharge } from './types';

const today = '2026-11-03';

describe('money already spent (not added to the balance)', () => {
  it('starts on for recent money, off for older than a month', () => {
    assert.equal(addsToBalanceByDefault(today, today), true);
    assert.equal(addsToBalanceByDefault('2026-10-03', today), true);
    assert.equal(addsToBalanceByDefault('2026-10-02', today), false);
    assert.equal(addsToBalanceByDefault('2025-12-26', today), false);
    // Unknown date: as before, into the account.
    assert.equal(addsToBalanceByDefault('', today), true);
  });

  it('a later amount needs no account and is sent without a deposit', () => {
    const form = {
      ...newChargeForm({ loanType: 'personal' }, today),
      principal: '2000',
      depositAddsToBalance: false,
    };
    assert.deepEqual(
      validateChargeForm(form, { today, needsInstallments: false }),
      {},
    );
    assert.deepEqual(buildChargeInput(form, 'p'), {
      debtId: 'p',
      date: today,
      principal: 2_000,
      destination: 'deposit',
      depositAddsToBalance: false,
    });
  });

  it('an amount saved without a deposit edits as off', () => {
    const charge = {
      id: 'c',
      date: '2026-01-10',
      description: null,
      principal: 2000,
      totalToRepay: 2000,
      installments: null,
      installmentsPaid: 0,
      firstPaymentDate: null,
      interestMode: null,
      interestRateAnnual: null,
      includesVat: false,
      destination: 'deposit',
      transactionId: null,
      depositAccountId: null,
      depositCountsAsIncome: null,
      depositAddsToBalance: false,
      purposeCategoryId: null,
      lendingMethod: null,
    } as ApiDebtCharge;
    assert.equal(chargeFormOf(charge).depositAddsToBalance, false);
    assert.equal(
      chargeFormOf({ ...charge, depositAddsToBalance: true })
        .depositAddsToBalance,
      true,
    );
  });

  it('a new loan is sent without its deposit', () => {
    const input = buildLoanInput({
      ...newLoanForm('institutional'),
      name: 'YoTePresto',
      principal: '188632',
      destination: 'deposit',
      depositAddsToBalance: false,
    });
    assert.equal(input.destination, 'deposit');
    assert.equal(input.depositAddsToBalance, false);
    assert.equal(input.depositAccountId, undefined);
  });

  it('editing a loan can take its deposit off the balance', () => {
    const debt = {
      name: 'YoTePresto',
      description: null,
      lenderName: 'YoTePresto',
      lenderContactId: null,
      lendingMethod: null,
      principal: 188_632,
      installmentsTotal: 24,
      installmentsPaid: 10,
      startDate: '2025-12-26',
      openingFee: null,
      periodicFee: null,
      purposeCategoryId: null,
      loanType: 'institutional',
      interestMode: 'rate',
      destination: 'deposit',
      depositAddsToBalance: true,
    } as unknown as ApiDebt;
    const form = loanEditFormOf(debt);
    assert.equal(form.depositAddsToBalance, true);
    assert.equal(buildLoanUpdate(form, debt), null);
    assert.deepEqual(
      buildLoanUpdate({ ...form, depositAddsToBalance: false }, debt),
      { depositAddsToBalance: false },
    );
    // Without a deposit there is nothing to remove.
    const none = { ...debt, depositAddsToBalance: false };
    assert.equal(loanEditFormOf(none).depositAddsToBalance, false);
  });
});
