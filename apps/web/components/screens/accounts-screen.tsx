'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Inbox, Landmark, Pencil, Plus } from 'lucide-react';

import { StatCard } from '@finnit/ui/components/finance/stat-card';
import { Button } from '@finnit/ui/components/ui/button';
import { SectionHeading } from '@finnit/ui/components/ui/section-heading';

import { AccountBalance } from '@/components/accounts/account-balance';
import { AccountFacts } from '@/components/accounts/account-facts';
import { AccountGroupSection } from '@/components/accounts/account-group-section';
import { AccountStatusBadge } from '@/components/accounts/account-status-badge';
import { AddAccountWizard } from '@/components/accounts/add-account-wizard';
import { EditAccountDialog } from '@/components/accounts/edit-account-dialog';
import { ShowArchivedToggle } from '@/components/accounts/show-archived-toggle';
import { EmptyState } from '@/components/finance/empty-state';
import { TransactionRow } from '@/components/finance/transaction-row';
import { useSessionUser } from '@/components/session-provider';
import type { AccountsData } from '@/lib/accounts/load';
import { groupAccounts } from '@/lib/accounts/view';

function accountsHref({
  account,
  archived,
}: {
  account?: string | null;
  archived: boolean;
}): string {
  const params = new URLSearchParams();
  if (account) params.set('account', account);
  if (archived) params.set('archived', '1');
  const query = params.toString();
  return query ? `/accounts?${query}` : '/accounts';
}

/** "Cuentas y tarjetas": every account by section, and the selected one's details. */
export function AccountsScreen({
  data,
  openWizard,
}: {
  data: AccountsData;
  /** Opened from "Agrégala manualmente" (/accounts?add=1). */
  openWizard: boolean;
}) {
  const user = useSessionUser();
  const t = useTranslations();
  const router = useRouter();
  const [wizardOpen, setWizardOpen] = React.useState(openWizard);
  const [editing, setEditing] = React.useState(false);
  const { accounts, detail, showArchived, archivedCount } = data;
  const groups = groupAccounts(accounts, t);
  const selected = detail?.account ?? null;

  const navigate = (
    account: string | null | undefined,
    archived = showArchived,
  ) => router.push(accountsHref({ account, archived }), { scroll: false });

  function closeWizard() {
    setWizardOpen(false);
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

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-3 px-1">
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] font-bold text-on-background">
          {t('accounts.title')}
        </h1>
        <span className="text-[11px] font-medium uppercase tracking-[0.15em] text-on-surface-variant">
          {t('accounts.count', { count: accounts.length })}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {archivedCount > 0 ? (
          <ShowArchivedToggle
            checked={showArchived}
            count={archivedCount}
            onChange={(archived) => navigate(selected?.id, archived)}
          />
        ) : null}
        <Button variant="secondary" onClick={() => setWizardOpen(true)}>
          <Plus aria-hidden /> {t('accounts.add')}
        </Button>
      </div>
    </div>
  );

  const wizard = wizardOpen ? (
    <AddAccountWizard
      existingNames={data.existingNames}
      holderName={user.name}
      onClose={closeWizard}
      onCreated={(id) => {
        setWizardOpen(false);
        router.push(accountsHref({ account: id, archived: showArchived }), {
          scroll: false,
        });
        router.refresh();
      }}
    />
  ) : null;

  if (!detail || !selected) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <EmptyState
          icon={Landmark}
          title={t('accounts.emptyTitle')}
          description={t('accounts.emptyDescription')}
          action={{
            href: '/settings/banks/connect',
            label: t('common.connectBank'),
          }}
        />
        {wizard}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {header}

      {groups.map((group) => (
        <AccountGroupSection
          key={group.key}
          group={group}
          selectedId={selected.id}
          holderName={user.name}
          onSelect={(id) => navigate(id)}
        />
      ))}

      <section
        aria-labelledby="account-detail-title"
        className="flex flex-col gap-3.5 border-t border-glass-border pt-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-[0.15em] text-on-surface-variant">
              {t('accounts.detailTitle')}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="account-detail-title"
                className="truncate text-lg font-bold text-on-background"
              >
                {selected.label}
              </h2>
              <AccountStatusBadge
                linked={selected.linked}
                archived={selected.archived}
              />
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditing(true)}
            aria-label={t('accounts.editLabel', { name: selected.label })}
          >
            <Pencil aria-hidden /> {t('accounts.edit')}
          </Button>
        </div>
        {selected.archived ? (
          <p className="px-1 text-xs text-on-surface-variant">
            {t('accounts.archive.archivedNote')}
          </p>
        ) : null}

        <div className="grid gap-3.5 md:grid-cols-2 lg:grid-cols-3">
          <AccountBalance card={selected} />
          <StatCard
            variant="expense"
            label={t('cards.expensesOf', { month: detail.monthLabel })}
            amount={detail.monthSpending}
            className="min-h-44"
          />
          <AccountFacts detail={detail} />
        </div>
      </section>

      <section>
        <SectionHeading
          title={t('cards.movementsOf', { name: selected.label })}
        />
        {detail.recent.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            {detail.recent.map((row) => (
              <TransactionRow key={row.id} row={row} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Inbox}
            title={t('cards.noMovementsTitle')}
            description={t('cards.noMovementsDescription')}
          />
        )}
      </section>

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
