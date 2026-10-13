'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Tags } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';

import { CategorizeFilters } from '@/components/categorize/categorize-filters';
import { CategorizeList } from '@/components/categorize/categorize-list';
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
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="mb-1 text-[32px] font-bold text-on-background">
            {t('title')}
          </h1>
          <p className="text-sm text-on-surface-variant">{t('subtitle')}</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/settings/aliases">
            <Tags aria-hidden /> {t('aliasesLink')}
          </Link>
        </Button>
      </div>

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
  );
}
