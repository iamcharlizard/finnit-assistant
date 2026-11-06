import { redirect } from 'next/navigation';

import { LOANS_PATH } from '@finnit/core/debts/view';

/** Loans are a tab of Deudas now; old links land there. */
export default function LoansPage() {
  redirect(LOANS_PATH);
}
