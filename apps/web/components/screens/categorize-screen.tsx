'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Shapes, Tags } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';

import { AutoCategorizeButton } from '@/components/categorize/auto-categorize-button';
import { CategorizeFilters } from '@/components/categorize/categorize-filters';
import { CategorizeList } from '@/components/categorize/categorize-list';
import { PageHeader } from '@/components/page-header';
import { TransferSuggestionsPanel } from '@/components/transfers/transfer-suggestions-panel';
import {
  categorizeQuery,
  type CategorizeFilters as Filters,
} from '@/lib/categorize/filters';
import type { CategorizeData } from '@/lib/categorize/load';

/** "Clasificar movimientos": filters, then the selectable list. */
export function CategorizeScreen({
  data,
  filters,
}: {
  data: CategorizeData;
  filters: Filters;
}) {
  const t = useTranslations('categorize');
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/settings/categories">
                <Shapes aria-hidden /> {t('categoriesLink')}
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/settings/aliases">
                <Tags aria-hidden /> {t('aliasesLink')}
              </Link>
            </Button>
            <AutoCategorizeButton />
          </>
        }
      />
      <div className="mx-auto w-full max-w-3xl">
        <TransferSuggestionsPanel
          suggestions={data.transferSuggestions.rows}
          total={data.transferSuggestions.total}
          categories={data.categories}
        />
        <CategorizeFilters
          filters={filters}
          accounts={data.accounts}
          today={data.today}
        />

        {/* New filters → new first page from the server: start the list over. */}
        <CategorizeList
          key={categorizeQuery(filters, data.today)}
          initial={data.page}
          filters={filters}
          categories={data.categories}
          today={data.today}
        />
      </div>
    </div>
  );
}
