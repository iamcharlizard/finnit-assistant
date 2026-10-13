import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { StatementReviewScreen } from '@/components/statements/statement-review-screen';
import { loadStatement } from '@/lib/statements/load';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('pageTitles.statements') };
}

export default async function StatementPage({
  params,
}: PageProps<'/statements/[id]'>) {
  const { id } = await params;
  const data = await loadStatement(id);
  // A new statement version from the server (after confirm/reprocess) starts the screen over.
  return <StatementReviewScreen key={data.statement.id} data={data} />;
}
