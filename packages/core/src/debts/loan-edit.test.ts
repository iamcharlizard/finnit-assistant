import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  buildLoanUpdate,
  loanEditFields,
  loanEditFormOf,
  validateLoanEdit,
} from './loan-edit';

const today = '2026-11-02';
const yoTePresto = {
  name: 'YoTePresto',
  description: null,
  lenderName: 'YoTePresto',
  lenderContactId: null,
  lendingMethod: null,
  principal: 200_000,
  installmentsTotal: 24,
  installmentsPaid: 10,
  startDate: '2025-12-26T00:00:00.000Z',
  openingFee: 11_368,
  periodicFee: null,
  purposeCategoryId: null,
  loanType: 'institutional' as const,
  interestMode: 'rate' as const,
  destination: 'deposit' as const,
  depositAddsToBalance: true,
};

describe('loan edit form', () => {
  it('starts from the loan and sends nothing when nothing changed', () => {
    const form = loanEditFormOf(yoTePresto);
    assert.equal(form.startDate, '2025-12-26');
    assert.equal(form.installments, '24');
    assert.equal(buildLoanUpdate(form, yoTePresto), null);
  });

  it('sends only what changed', () => {
    const form = {
      ...loanEditFormOf(yoTePresto),
      periodicFee: '299',
      lenderName: '',
      purposeCategoryId: 'tech',
    };
    assert.deepEqual(buildLoanUpdate(form, yoTePresto), {
      lenderName: null,
      periodicFee: 299,
      purposeCategoryId: 'tech',
    });
    assert.deepEqual(
      buildLoanUpdate(
        { ...loanEditFormOf(yoTePresto), openingFee: '' },
        yoTePresto,
      ),
      { openingFee: 0 },
    );
  });

  it('shows the fields of each kind of loan', () => {
    assert.deepEqual(loanEditFields(yoTePresto), {
      installments: true,
      openingFee: true,
      periodicFee: true,
    });
    assert.deepEqual(
      loanEditFields({
        ...yoTePresto,
        loanType: 'personal',
        interestMode: null,
      }),
      { installments: false, openingFee: false, periodicFee: false },
    );
  });

  it('validates the amount, the payments and the fees', () => {
    const form = loanEditFormOf(yoTePresto);
    assert.deepEqual(validateLoanEdit(form, yoTePresto, { today }), {});
    assert.deepEqual(
      validateLoanEdit(
        {
          ...form,
          name: ' ',
          installments: '8',
          openingFee: '300000',
          startDate: '2027-01-01',
        },
        yoTePresto,
        { today },
      ),
      {
        name: 'nameRequired',
        installments: 'installmentsBelowPaid',
        openingFee: 'openingFeeInvalid',
        startDate: 'dateInFuture',
      },
    );
  });

  it('changes the contact of a personal loan', () => {
    const personal = {
      ...yoTePresto,
      loanType: 'personal' as const,
      interestMode: null,
      lenderName: 'Ana',
      lenderContactId: 'ana',
    };
    const form = loanEditFormOf(personal);
    assert.deepEqual(
      buildLoanUpdate({ ...form, lenderContactId: 'luis' }, personal),
      { lenderContactId: 'luis' },
    );
    assert.deepEqual(
      buildLoanUpdate({ ...form, lenderContactId: '' }, personal),
      { lenderContactId: null },
    );
  });

  it('clears an unknown date and sends how it was lent', () => {
    const personal = {
      ...yoTePresto,
      loanType: 'personal' as const,
      interestMode: null,
    };
    const form = loanEditFormOf(personal);
    assert.deepEqual(
      buildLoanUpdate(
        { ...form, startDate: '', lendingMethod: 'credit_card' },
        personal,
      ),
      { startDate: null, lendingMethod: 'credit_card' },
    );
  });
});
