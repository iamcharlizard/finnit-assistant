import { redirect } from 'next/navigation';

import { DEBTS_PATH } from '@finnit/core/debts/view';

/** A loan's page lives under Deudas now. */
export default async function LoanPage({
  params,
}: PageProps<'/planning/loans/[id]'>) {
  const { id } = await params;
  redirect(`${DEBTS_PATH}/${encodeURIComponent(id)}`);
}
