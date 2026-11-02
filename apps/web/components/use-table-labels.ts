'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import type { DataTableLabels } from '@finnit/ui/components/ui/data-table';

/** DataTable's pager and sorting texts in the user's language. */
export function useTableLabels(): DataTableLabels {
  const t = useTranslations('ui.table');
  return React.useMemo(
    () => ({
      rowsPerPage: t('rowsPerPage'),
      page: (page, pageCount) => t('page', { page, pageCount }),
      firstPage: t('firstPage'),
      previousPage: t('previousPage'),
      nextPage: t('nextPage'),
      lastPage: t('lastPage'),
      sortBy: (column) => t('sortBy', { column }),
      empty: t('empty'),
    }),
    [t],
  );
}
