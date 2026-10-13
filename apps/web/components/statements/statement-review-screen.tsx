'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  ArrowLeft,
  CircleCheck,
  Download,
  Loader2,
  Trash2,
  TriangleAlert,
} from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { Card } from '@finnit/ui/components/ui/card';
import { toast } from '@finnit/ui/components/ui/toaster';

import {
  ConfirmDialog,
  type ConfirmRequest,
} from '@/components/admin/confirm-dialog';
import { useStatementPolling } from '@/hooks/use-statement-polling';
import { todayKey } from '@/lib/finance/dates';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import { categoryOptions } from '@/lib/new-entry/options';
import {
  confirmStatement,
  deleteStatement,
  reprocessStatement,
  statementErrorMessage,
  updateLine,
  type LineChange,
  type ReprocessParser,
} from '@/lib/statements/api';
import type { StatementReviewData } from '@/lib/statements/load';
import type { ApiStatementDetail } from '@/lib/statements/types';
import {
  accountsById,
  categoriesById,
  isDebit,
  lineCounts,
  toStatementDetailView,
  type StatementLineView,
} from '@/lib/statements/view';
import { LinkTransactionDialog } from './link-transaction-dialog';
import { ReprocessControl } from './reprocess-control';
import { StatementCheckCard } from './statement-check-card';
import { StatementFactsCard } from './statement-facts-card';
import { StatementLineRow } from './statement-line-row';
import { StatementStatusBadge } from './statement-status-badge';

/**
 * /statements/[id]: follows the extraction, then the review — totals and
 * their check, each line (category, ignore, link) — and "Confirmar".
 */
export function StatementReviewScreen({ data }: { data: StatementReviewData }) {
  const router = useRouter();
  const l = useLocalizer();
  const { t } = l;
  const ts = useTranslations('statements');
  const locale = useLocale();
  const [statement, setStatement] = React.useState<ApiStatementDetail>(
    data.statement,
  );
  const [pollStart, setPollStart] = React.useState(() => Date.now());
  const [busy, setBusy] = React.useState<string | null>(null);
  const [linking, setLinking] = React.useState<StatementLineView | null>(null);
  const [confirm, setConfirm] = React.useState<ConfirmRequest | null>(null);
  const { timedOut } = useStatementPolling(statement, setStatement, pollStart);

  const accounts = React.useMemo(
    () => accountsById(data.accounts),
    [data.accounts],
  );
  const categories = React.useMemo(
    () => categoriesById(data.categories),
    [data.categories],
  );
  const options = React.useMemo(
    () => ({
      expense: categoryOptions(data.categories, 'expense', locale),
      income: categoryOptions(data.categories, 'income', locale),
    }),
    [data.categories, locale],
  );
  const view = React.useMemo(
    () => toStatementDetailView(statement, accounts, categories, todayKey(), l),
    [statement, accounts, categories, l],
  );
  const working =
    statement.status === 'uploaded' || statement.status === 'processing';

  const fail = (error: unknown) => toast.error(statementErrorMessage(error, t));

  async function changeLine(id: string, change: LineChange) {
    setBusy(id);
    try {
      const updated = await updateLine(id, change, gql);
      setStatement((s) => ({
        ...s,
        lines: (s.lines ?? []).map((line) => (line.id === id ? updated : line)),
      }));
    } catch (error) {
      fail(error);
    } finally {
      setBusy(null);
    }
  }

  async function reprocess(parser: ReprocessParser) {
    setBusy('statement');
    try {
      setStatement(await reprocessStatement(statement.id, parser, gql));
      setPollStart(Date.now());
    } catch (error) {
      fail(error);
    } finally {
      setBusy(null);
    }
  }

  function askConfirm() {
    setConfirm({
      title: ts('confirmTitle'),
      description: ts('confirmDescription', {
        count: view.counts.pending,
        account: view.account,
      }),
      confirmLabel: ts('confirm'),
      onConfirm: () => {
        setConfirm(null);
        setBusy('statement');
        confirmStatement(statement.id, gql)
          .then((confirmed) => {
            setStatement(confirmed);
            const counts = lineCounts(confirmed.lines ?? []);
            toast.success(
              ts('confirmed', {
                created: counts.created,
                matched: counts.matched,
              }),
            );
            router.refresh();
          })
          .catch(fail)
          .finally(() => setBusy(null));
      },
    });
  }

  function askDelete() {
    setConfirm({
      title: ts('deleteTitle'),
      description: ts('deleteDescription'),
      confirmLabel: ts('delete'),
      destructive: true,
      onConfirm: () => {
        setConfirm(null);
        setBusy('statement');
        deleteStatement(statement.id, gql)
          .then(() => {
            toast.success(ts('deleted'));
            router.replace('/statements');
            router.refresh();
          })
          .catch((error: unknown) => {
            fail(error);
            setBusy(null);
          });
      },
    });
  }

  const counts = view.counts;
  return (
    <div className="flex flex-col gap-5">
      <Button variant="ghost" size="sm" className="self-start" asChild>
        <Link href="/statements">
          <ArrowLeft aria-hidden /> {ts('back')}
        </Link>
      </Button>

      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-on-background">
            {view.account}
          </h1>
          <StatementStatusBadge status={view.status} label={view.statusLabel} />
        </div>
        <p className="text-sm text-on-surface-variant">
          {view.period}
          {view.parser ? ` · ${ts('parser', { parser: view.parser })}` : ''}
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {view.canConfirm ? (
            <Button onClick={askConfirm} disabled={busy !== null}>
              <CircleCheck aria-hidden /> {ts('confirm')}
            </Button>
          ) : null}
          {view.fileHref ? (
            <Button variant="outline" asChild>
              <a href={view.fileHref} download>
                <Download aria-hidden /> {ts('download')}
              </a>
            </Button>
          ) : null}
          {view.canDelete ? (
            <Button
              variant="destructive"
              onClick={askDelete}
              disabled={busy !== null}
            >
              <Trash2 aria-hidden /> {ts('delete')}
            </Button>
          ) : null}
        </div>
      </header>

      {working ? (
        <Card
          className="flex-row items-start gap-3 rounded-[20px] p-5"
          aria-live="polite"
        >
          <Loader2
            aria-hidden
            className="mt-0.5 size-5 shrink-0 animate-spin text-brand-ink motion-reduce:animate-none"
          />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-on-background">
              {timedOut ? ts('timeout') : ts('processing')}
            </p>
            {timedOut ? (
              <Button
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => window.location.reload()}
              >
                {ts('reload')}
              </Button>
            ) : (
              <p className="text-xs text-on-surface-variant">
                {ts('processingHint')}
              </p>
            )}
          </div>
        </Card>
      ) : null}

      {view.status === 'failed' ? (
        <Card className="gap-3 rounded-[20px] border-expense/40 p-5">
          <p className="flex items-center gap-2 text-sm font-bold text-expense">
            <TriangleAlert aria-hidden className="size-5" />
            {ts('failedTitle')}
          </p>
          {view.errorMessage ? (
            <p className="text-sm text-on-surface-variant">
              {view.errorMessage}
            </p>
          ) : null}
        </Card>
      ) : null}

      {view.canReprocess ? (
        <ReprocessControl
          busy={busy !== null}
          onReprocess={(p) => void reprocess(p)}
        />
      ) : null}

      {!working && view.status !== 'failed' ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-start">
          <div className="flex flex-col gap-5">
            <StatementCheckCard check={view.check} />
            <StatementFactsCard facts={view.facts} />
          </div>

          <section aria-labelledby="statement-lines" className="min-w-0">
            <h2
              id="statement-lines"
              className="px-1 text-base font-bold text-on-background"
            >
              {ts('lines.title', { count: view.lines.length })}
            </h2>
            <p className="mb-3 px-1 text-xs text-on-surface-variant">
              {view.status === 'confirmed'
                ? ts('lines.summaryConfirmed', {
                    created: counts.created,
                    matched: counts.matched,
                    ignored: counts.ignored,
                  })
                : ts('lines.summary', {
                    pending: counts.pending,
                    matched: counts.matched,
                    ignored: counts.ignored,
                  })}
            </p>
            {view.lines.length === 0 ? (
              <p className="px-1 text-sm text-on-surface-variant">
                {ts('lines.empty')}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {view.lines.map((line) => (
                  <StatementLineRow
                    key={line.id}
                    line={line}
                    editable={view.canEdit}
                    busy={busy === line.id || busy === 'statement'}
                    categories={
                      isDebit(line.kind) || line.kind === 'refund'
                        ? options.expense
                        : options.income
                    }
                    onCategory={(categoryId) =>
                      void changeLine(line.id, { categoryId })
                    }
                    onStatus={(status) => void changeLine(line.id, { status })}
                    onLink={() => setLinking(line)}
                    onUnlink={() =>
                      void changeLine(line.id, { matchedTransactionId: null })
                    }
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}

      {linking ? (
        <LinkTransactionDialog
          accountId={view.accountId}
          line={linking}
          currency={statement.currency}
          onClose={() => setLinking(null)}
          onPick={(transactionId) => {
            const id = linking.id;
            setLinking(null);
            void changeLine(id, { matchedTransactionId: transactionId });
          }}
        />
      ) : null}
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
