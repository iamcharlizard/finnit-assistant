import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { BudgetsScreen } from '@/components/budgets/budgets-screen';
import { currentMonth, loadBudgets } from '@/lib/budgets/load';
import { MAX_MONTHS_AHEAD } from '@/lib/budgets/view';
import {
  formatMonthParam,
  parseMonthParam,
  shiftMonth,
} from '@/lib/finance/dates';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('pageTitles.budgets') };
}

export default async function BudgetsPage({
  searchParams,
}: PageProps<'/planning/budgets'>) {
  const current = currentMonth();
  const requested = parseMonthParam((await searchParams).month, current);
  // Budgets can be planned up to a year ahead.
  const latest = shiftMonth(current, MAX_MONTHS_AHEAD);
  const selected =
    formatMonthParam(requested) > formatMonthParam(latest) ? latest : requested;
  return <BudgetsScreen view={await loadBudgets(selected)} />;
}
