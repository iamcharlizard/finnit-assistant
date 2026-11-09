import { Prisma } from '@finnit/database';

/**
 * Movements that already belong to something that keeps them as they are:
 * a transfer, a loan, or the account's "Diferencia con el banco".
 */
export const FREE_MOVEMENT: Prisma.TransactionWhereInput = {
  transferFrom: { is: null },
  transferTo: { is: null },
  bankDifferenceOf: { is: null },
  debtPayment: { is: null },
  debtCharge: { is: null },
  debtDisbursement: { is: null },
};
