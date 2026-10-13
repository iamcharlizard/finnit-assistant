'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { FileText } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { LabelSm } from '@finnit/ui/components/ui/typography';

import { EmptyState } from '@/components/finance/empty-state';
import type { Connection } from '@/lib/finance/types';
import { gql, requestErrorMessage } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import {
  STATEMENTS_PAGE_SIZE,
  STATEMENTS_QUERY,
  type StatementsData,
} from '@/lib/statements/queries';
import type { ApiStatementImport } from '@/lib/statements/types';
import { accountsById, toStatementListItem } from '@/lib/statements/view';
import { StatementListItem } from './statement-list-item';
import { StatementUploadCard } from './statement-upload-card';

/** /statements: upload a card statement and the ones uploaded before. */
export function StatementsScreen({
  data,
  initialAccountId,
}: {
  data: StatementsData;
  initialAccountId?: string;
}) {
  const l = useLocalizer();
  const t = useTranslations('statements');
  const [items, setItems] = React.useState(data.items);
  const [page, setPage] = React.useState({
    endCursor: data.endCursor,
    hasNextPage: data.hasNextPage,
    totalCount: data.totalCount,
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const accounts = React.useMemo(
    () => accountsById(data.accounts),
    [data.accounts],
  );

  // A refresh brings a new first page.
  React.useEffect(() => {
    setItems(data.items);
    setPage({
      endCursor: data.endCursor,
      hasNextPage: data.hasNextPage,
      totalCount: data.totalCount,
    });
  }, [data]);

  async function loadMore() {
    setLoading(true);
    setError(null);
    try {
      const result = await gql<{
        statementImports: Connection<ApiStatementImport>;
      }>(STATEMENTS_QUERY, {
        first: STATEMENTS_PAGE_SIZE,
        after: page.endCursor,
      });
      const next = result.statementImports;
      setItems((current) => [
        ...current,
        ...next.edges.map((e) => toStatementListItem(e.node, accounts, l)),
      ]);
      setPage({
        endCursor: next.pageInfo.endCursor,
        hasNextPage: next.pageInfo.hasNextPage,
        totalCount: next.totalCount,
      });
    } catch (e) {
      setError(requestErrorMessage(e, l.t));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="mb-1 text-[32px] font-bold text-on-background">
          {t('title')}
        </h1>
        <p className="text-sm text-on-surface-variant">{t('subtitle')}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-start">
        <StatementUploadCard
          cards={data.cards}
          initialAccountId={initialAccountId}
        />

        <section aria-labelledby="statements-list" className="min-w-0">
          <LabelSm as="h2" id="statements-list" className="mb-3 block px-1">
            {t('listTitle')}
          </LabelSm>
          {items.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={t('emptyTitle')}
              description={t('emptyDescription')}
            />
          ) : (
            <>
              <p
                className="mb-3 px-1 text-xs text-on-surface-variant"
                aria-live="polite"
              >
                {t('count', {
                  shown: String(items.length),
                  total: page.totalCount,
                })}
              </p>
              <ul className="flex flex-col gap-2">
                {items.map((item) => (
                  <StatementListItem key={item.id} item={item} />
                ))}
              </ul>
            </>
          )}
          {error ? (
            <p role="alert" className="mt-3 text-sm text-expense">
              {error}
            </p>
          ) : null}
          {page.hasNextPage ? (
            <Button
              variant="outline"
              className="mt-3 w-full"
              onClick={() => void loadMore()}
              disabled={loading}
            >
              {loading ? l.t('common.loading') : l.t('common.loadMore')}
            </Button>
          ) : null}
        </section>
      </div>
    </div>
  );
}
