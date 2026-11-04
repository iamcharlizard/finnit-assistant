'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { FileUp, Landmark, Pencil, Plus } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { cn } from '@finnit/ui/lib/utils';

import { AccountCardStack } from '@/components/accounts/account-card-stack';
import { AccountMovements } from '@/components/accounts/account-movements';
import { AccountStats } from '@/components/accounts/account-stats';
import { AccountStatusBadge } from '@/components/accounts/account-status-badge';
import { AddAccountWizard } from '@/components/accounts/add-account-wizard';
import { EditAccountDialog } from '@/components/accounts/edit-account-dialog';
import { ShowArchivedToggle } from '@/components/accounts/show-archived-toggle';
import { EmptyState } from '@/components/finance/empty-state';
import { PageHeader } from '@/components/page-header';
import { useSessionUser } from '@/components/session-provider';
import type { AccountsData } from '@/lib/accounts/load';

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

/**
 * "Cuentas y tarjetas": every account as a stack of cards on the left and the
 * selected one's figures, actions and movements on the right.
 */
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
  const selected = detail?.account ?? null;
  const [pending, startTransition] = React.useTransition();
  // The card moves at once; its details arrive with the navigation.
  const [requestedId, setRequestedId] = React.useState<string | null>(null);
  const activeId = (pending && requestedId) || selected?.id;

  const navigate = (
    account: string | null | undefined,
    archived = showArchived,
  ) =>
    startTransition(() =>
      router.push(accountsHref({ account, archived }), { scroll: false }),
    );

  function selectAccount(id: string) {
    if (id === activeId) return;
    setRequestedId(id);
    navigate(id);
  }

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
          <Button variant="secondary" onClick={() => setWizardOpen(true)}>
            <Plus aria-hidden /> {t('accounts.add')}
          </Button>
        </>
      }
    />
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

  const subtitle = [
    selected.label !== selected.name ? selected.name : null,
    selected.bankName,
    selected.last4 ? `•${selected.last4}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex flex-col gap-6">
      {header}

      <div className="grid gap-8 @3xl:grid-cols-[360px_minmax(0,1fr)] @3xl:items-start">
        <div className="@3xl:sticky @3xl:top-28">
          <AccountCardStack
            accounts={accounts}
            activeId={activeId ?? selected.id}
            holderName={user.name}
            label={t('accounts.stackLabel')}
            onSelect={selectAccount}
          />
        </div>

        <section
          aria-labelledby="account-detail-title"
          aria-busy={pending}
          className={cn(
            'flex min-w-0 flex-col gap-4 transition-opacity',
            pending && 'opacity-60',
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-3 px-1">
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id="account-detail-title"
                  className="truncate text-xl font-bold text-on-background"
                >
                  {selected.label}
                </h2>
                <AccountStatusBadge
                  linked={selected.linked}
                  archived={selected.archived}
                />
              </div>
              {subtitle ? (
                <p className="truncate text-sm text-on-surface-variant">
                  {subtitle}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {selected.type === 'credit' ? (
                <Button variant="outline" size="sm" asChild>
                  <Link
                    href={`/statements?account=${encodeURIComponent(selected.id)}`}
                  >
                    <FileUp aria-hidden /> {t('statements.uploadFromAccount')}
                  </Link>
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(true)}
                aria-label={t('accounts.editLabel', { name: selected.label })}
              >
                <Pencil aria-hidden /> {t('accounts.edit')}
              </Button>
            </div>
          </div>
          {selected.archived ? (
            <p className="px-1 text-xs text-on-surface-variant">
              {t('accounts.archive.archivedNote')}
            </p>
          ) : null}

          <AccountStats detail={detail} />
          <AccountMovements detail={detail} />
        </section>
      </div>

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
