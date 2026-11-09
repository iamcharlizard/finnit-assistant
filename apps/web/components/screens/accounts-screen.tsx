'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  FileUp,
  Landmark,
  Layers,
  Maximize2,
  Minimize2,
  Pencil,
  Plus,
  RefreshCw,
} from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { cn } from '@finnit/ui/lib/utils';

import {
  AccountActions,
  type AccountAction,
} from '@/components/accounts/account-actions';
import { AccountCardStack } from '@/components/accounts/account-card-stack';
import { AccountsOverview } from '@/components/accounts/accounts-overview';
import { AccountMovements } from '@/components/accounts/account-movements';
import { AccountStats } from '@/components/accounts/account-stats';
import { CardPeriods } from '@/components/accounts/card-periods';
import {
  AccountStatusBadge,
  ExcludedFromTotalBadge,
} from '@/components/accounts/account-status-badge';
import { AddAccountWizard } from '@/components/accounts/add-account-wizard';
import {
  BalanceDayNav,
  BalanceDayStats,
  HistoricalNotice,
} from '@/components/accounts/balance-day';
import { BalanceUpdateDialog } from '@/components/accounts/balance-update-dialog';
import { DailyBalanceChart } from '@/components/accounts/daily-balance-chart';
import { EditAccountDialog } from '@/components/accounts/edit-account-dialog';
import { ShowArchivedToggle } from '@/components/accounts/show-archived-toggle';
import { EmptyState } from '@/components/finance/empty-state';
import { PageHeader } from '@/components/page-header';
import { useSessionUser } from '@/components/session-provider';
import type { AccountsData } from '@/lib/accounts/load';
import type { DayKey } from '@finnit/core/finance/dates';

export function accountsHref({
  account,
  archived,
  day,
  focused = false,
}: {
  account?: string | null;
  archived: boolean;
  /** A past day (balance by day); none = today. */
  day?: DayKey | null;
  /** The account's own page (/accounts/<id>), without the other cards. */
  focused?: boolean;
}): string {
  const params = new URLSearchParams();
  if (account && !focused) params.set('account', account);
  if (archived && !focused) params.set('archived', '1');
  if (day) params.set('day', day);
  const query = params.toString();
  const path =
    focused && account
      ? `/accounts/${encodeURIComponent(account)}`
      : '/accounts';
  return query ? `${path}?${query}` : path;
}

/**
 * "Cuentas y tarjetas": every account as a stack of cards on the left and the
 * selected one's figures, actions and movements on the right. `focused`
 * (/accounts/<id>) shows only that account, across the whole width.
 */
export function AccountsScreen({
  data,
  openWizard = null,
  focused = false,
}: {
  data: AccountsData;
  /**
   * Opened from a link: "Agrégala manualmente" (/accounts?add=1) or
   * "Conectar banco" (/accounts?add=bank).
   */
  openWizard?: 'manual' | 'bank' | null;
  focused?: boolean;
}) {
  const user = useSessionUser();
  const t = useTranslations();
  const router = useRouter();
  const [wizardStart, setWizardStart] = React.useState<
    'choose' | 'manual' | 'bank' | null
  >(openWizard ?? null);
  const [editing, setEditing] = React.useState(false);
  const [updatingBalance, setUpdatingBalance] = React.useState(false);
  const { accounts, detail, timeline, showArchived, archivedCount } = data;
  // The day stays when another account is chosen.
  const day = timeline && !timeline.isToday ? timeline.day : null;
  const selected = detail?.account ?? null;
  const [pending, startTransition] = React.useTransition();
  // The card moves at once; its details arrive with the navigation
  // (`id: null` = none, all accounts together).
  const [requested, setRequested] = React.useState<{
    id: string | null;
  } | null>(null);
  const activeId = pending && requested ? requested.id : (selected?.id ?? null);

  const navigate = (
    account: string | null | undefined,
    archived = showArchived,
    onDay: DayKey | null = day,
  ) =>
    startTransition(() =>
      router.push(accountsHref({ account, archived, day: onDay, focused }), {
        scroll: false,
      }),
    );

  const showDay = (next: DayKey | null) =>
    navigate(selected?.id, showArchived, next);

  /** Choosing the active card again lets it go: all accounts together. */
  function selectAccount(id: string | null) {
    const next = id === activeId ? null : id;
    if (next === activeId) return;
    setRequested({ id: next });
    navigate(next);
  }

  const stack = (
    <div className="flex flex-col gap-3 @3xl:sticky @3xl:top-28">
      <Button
        variant="outline"
        size="sm"
        aria-pressed={activeId === null}
        onClick={() => selectAccount(null)}
        className={cn(
          'mx-auto self-center @3xl:mx-0 @3xl:self-start',
          activeId === null &&
            'border-brand bg-brand/10 text-brand-ink hover:bg-brand/15',
        )}
      >
        <Layers aria-hidden /> {t('accounts.overview.chip')}
      </Button>
      <AccountCardStack
        accounts={accounts}
        activeId={activeId}
        holderName={user.name}
        label={t('accounts.stackLabel')}
        onSelect={selectAccount}
      />
    </div>
  );

  function closeWizard() {
    setWizardStart(null);
    // A bank connected inside it brings new accounts.
    router.refresh();
    // Drop ?add=1 so a refresh doesn't open it again.
    if (openWizard) {
      router.replace(
        accountsHref({ account: selected?.id, archived: showArchived }),
        {
          scroll: false,
        },
      );
    }
  }

  const header = focused ? null : (
    <PageHeader
      title={t('accounts.title')}
      subtitle={t('accounts.count', { count: accounts.length })}
      actions={
        <>
          {archivedCount > 0 ? (
            <ShowArchivedToggle
              checked={showArchived}
              count={archivedCount}
              onChange={(archived) => navigate(selected?.id, archived)}
            />
          ) : null}
          <Button variant="secondary" onClick={() => setWizardStart('choose')}>
            <Plus aria-hidden /> {t('accounts.add')}
          </Button>
        </>
      }
    />
  );

  const wizard = wizardStart ? (
    <AddAccountWizard
      existingNames={data.existingNames}
      holderName={user.name}
      start={wizardStart}
      onClose={closeWizard}
      onCreated={(id) => {
        setWizardStart(null);
        router.push(accountsHref({ account: id, archived: showArchived }), {
          scroll: false,
        });
        router.refresh();
      }}
    />
  ) : null;

  if (!selected && data.overview) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="grid gap-8 @3xl:grid-cols-[360px_minmax(0,1fr)] @3xl:items-start">
          {stack}
          <div
            aria-busy={pending}
            className={cn(
              'min-w-0 transition-opacity',
              pending && 'opacity-60',
            )}
          >
            <AccountsOverview
              overview={data.overview}
              onDay={(next) => navigate(null, showArchived, next)}
            />
          </div>
        </div>
        {wizard}
      </div>
    );
  }

  if (!detail || !selected) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <EmptyState
          icon={Landmark}
          title={t('accounts.emptyTitle')}
          description={t('accounts.emptyDescription')}
          action={{
            onClick: () => setWizardStart('bank'),
            label: t('common.connectBank'),
          }}
        />
        {wizard}
      </div>
    );
  }

  const subtitle = [
    selected.label !== selected.name ? selected.name : null,
    selected.bankName,
    selected.last4 ? `•${selected.last4}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  // Back to the list with this account (and day) selected.
  const listHref = accountsHref({
    account: selected.id,
    archived: showArchived || selected.archived,
    day,
  });

  const actions: AccountAction[] = [
    ...(selected.type === 'credit'
      ? [
          {
            key: 'statement',
            icon: FileUp,
            label: t('statements.uploadFromAccount'),
            href: `/statements?account=${encodeURIComponent(selected.id)}`,
          },
        ]
      : []),
    ...(selected.archived
      ? []
      : [
          {
            key: 'balance',
            icon: RefreshCw,
            label: t('accounts.balanceUpdate.action'),
            onSelect: () => setUpdatingBalance(true),
          },
        ]),
    {
      key: 'edit',
      icon: Pencil,
      label: t('accounts.edit'),
      onSelect: () => setEditing(true),
    },
    focused
      ? {
          key: 'collapse',
          icon: Minimize2,
          label: t('accounts.focus.collapse'),
          href: listHref,
        }
      : {
          key: 'expand',
          icon: Maximize2,
          label: t('accounts.focus.expand'),
          href: accountsHref({
            account: selected.id,
            archived: false,
            day,
            focused: true,
          }),
        },
  ];

  return (
    <div className="flex flex-col gap-6">
      {focused ? (
        <PageHeader
          title={selected.label}
          subtitle={subtitle || undefined}
          back={{ href: listHref, label: t('accounts.focus.back') }}
        />
      ) : (
        header
      )}

      <div
        className={cn(
          'grid gap-8',
          !focused && '@3xl:grid-cols-[360px_minmax(0,1fr)] @3xl:items-start',
        )}
      >
        {focused ? null : stack}

        <section
          aria-labelledby="account-detail-title"
          aria-busy={pending}
          className={cn(
            'flex min-w-0 flex-col gap-4 transition-opacity',
            pending && 'opacity-60',
          )}
        >
          {/* Phones: the "…" menu beside the title. Wide: the buttons go in
              the toolbar below (on the account's own page the title is in
              the top bar, so this row goes away). */}
          <div
            className={cn(
              'flex items-start justify-between gap-3 px-1',
              focused && '@3xl:hidden',
            )}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id="account-detail-title"
                  className={cn(
                    'truncate text-xl font-bold text-on-background',
                    // The page title already says it.
                    focused && 'sr-only',
                  )}
                >
                  {selected.label}
                </h2>
                <AccountStatusBadge
                  linked={selected.linked}
                  archived={selected.archived}
                  defaultCash={selected.defaultCash}
                />
                {selected.includedInTotal ? null : <ExcludedFromTotalBadge />}
              </div>
              {subtitle && !focused ? (
                <p className="truncate text-sm text-on-surface-variant">
                  {subtitle}
                </p>
              ) : null}
            </div>
            <AccountActions
              display="menu"
              accountLabel={selected.label}
              actions={actions}
            />
          </div>
          {selected.archived ? (
            <p className="px-1 text-xs text-on-surface-variant">
              {t('accounts.archive.archivedNote')}
            </p>
          ) : null}

          {/* Wide: the day on the left and the actions on the right; on the
              account's own page the day is centred (a 1fr·auto·1fr grid: the
              middle column stays centred while the sides fit). */}
          <div
            className={cn(
              'flex flex-wrap items-center justify-between gap-3',
              focused && '@3xl:grid @3xl:grid-cols-[1fr_auto_1fr]',
            )}
          >
            {focused ? (
              <span className="hidden justify-self-start gap-2 px-1 @3xl:inline-flex">
                <AccountStatusBadge
                  linked={selected.linked}
                  archived={selected.archived}
                  defaultCash={selected.defaultCash}
                />
                {selected.includedInTotal ? null : <ExcludedFromTotalBadge />}
              </span>
            ) : null}
            {timeline ? (
              <BalanceDayNav timeline={timeline} onDay={showDay} />
            ) : (
              <span />
            )}
            <AccountActions
              display="buttons"
              accountLabel={selected.label}
              actions={actions}
              className={cn(
                focused && '@3xl:flex-nowrap @3xl:justify-self-end',
              )}
            />
          </div>
          {timeline && !timeline.isToday ? (
            <>
              <HistoricalNotice
                timeline={timeline}
                onToday={() => showDay(null)}
              />
              <BalanceDayStats timeline={timeline} />
            </>
          ) : (
            <AccountStats detail={detail} />
          )}
          {selected.type === 'credit' ? (
            // A new balance (a payment, a charge): ask for the cycles again.
            <CardPeriods
              key={`${selected.id}:${selected.amount}`}
              accountId={selected.id}
            />
          ) : null}
          {timeline ? (
            <DailyBalanceChart
              title={t(
                timeline.isCredit
                  ? 'accounts.balanceDay.chartTitleDebt'
                  : 'accounts.balanceDay.chartTitle',
              )}
              days={timeline.points}
              series={[
                {
                  key: 'balance',
                  label: t(
                    timeline.isCredit
                      ? 'accounts.balanceDay.tableDebt'
                      : 'accounts.balanceDay.tableBalance',
                  ),
                  color: 'var(--chart-1)',
                  values: timeline.points.map((p) => p.value),
                  amounts: timeline.points.map((p) => p.amount),
                },
              ]}
              selectedDay={timeline.day}
              completeFromLabel={timeline.completeFromLabel}
              currency={selected.currency}
              onDay={showDay}
            />
          ) : null}
          <AccountMovements
            rows={detail.recent}
            historyHref={detail.historyHref}
            dayLabel={timeline && !timeline.isToday ? timeline.dayLabel : null}
          />
        </section>
      </div>

      {updatingBalance ? (
        <BalanceUpdateDialog
          account={selected}
          onClose={() => setUpdatingBalance(false)}
          onSaved={() => {
            setUpdatingBalance(false);
            router.refresh();
          }}
        />
      ) : null}
      {editing ? (
        <EditAccountDialog
          account={selected}
          holderName={user.name}
          onClose={() => setEditing(false)}
          onSaved={(change) => {
            setEditing(false);
            if (change?.archived && !showArchived) {
              // The archived account leaves the list: show the first one.
              router.push(accountsHref({ archived: false }), { scroll: false });
            }
            router.refresh();
          }}
        />
      ) : null}
      {wizard}
    </div>
  );
}
