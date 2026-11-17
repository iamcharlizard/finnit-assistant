/**
 * "Diferencia con el banco": the adjustment that keeps a bank-linked
 * account equal to the bank's balance. It changes with every sync and goes
 * when they match; "Recalcular con el saldo del banco" compares them now
 * (after fixing movements by hand). Shared by the web and the mobile app.
 */
import type { GqlRunner } from '../graphql/request';

export const RECALCULATE_BANK_DIFFERENCE_MUTATION = `mutation RecalculateBankDifference($accountId: ID!) { recalculateBankDifference(accountId: $accountId) }`;

/** False when the account isn't linked to a bank. */
export async function recalculateBankDifference(
  accountId: string,
  run: GqlRunner,
): Promise<boolean> {
  const data = await run<{ recalculateBankDifference: boolean }>(
    RECALCULATE_BANK_DIFFERENCE_MUTATION,
    { accountId },
  );
  return data.recalculateBankDifference;
}
