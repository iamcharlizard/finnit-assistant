'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Tags, Text } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { toast } from '@finnit/ui/components/ui/toaster';

import {
  ConfirmDialog,
  type ConfirmRequest,
} from '@/components/admin/confirm-dialog';
import { AliasCard } from '@/components/aliases/alias-card';
import { AliasDialog } from '@/components/aliases/alias-dialog';
import { RuleList } from '@/components/aliases/rule-list';
import { EmptyState } from '@/components/finance/empty-state';
import {
  aliasErrorMessage,
  deleteAlias,
  deleteRule,
  setAliasActive,
} from '@/lib/aliases/api';
import type { AliasesData } from '@/lib/aliases/load';
import type { ApiMerchantAlias, ApiMerchantRule } from '@/lib/aliases/types';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';

type DialogState = { alias: ApiMerchantAlias | null } | null;

/**
 * "Alias de movimientos": the alias rules (create, edit, enable, delete)
 * and the category rules learned while categorizing.
 */
export function AliasesScreen({ data }: { data: AliasesData }) {
  const router = useRouter();
  const { t } = useLocalizer();
  const [pending, startTransition] = React.useTransition();
  const [dialog, setDialog] = React.useState<DialogState>(null);
  const [confirm, setConfirm] = React.useState<ConfirmRequest | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  // The switch flips at once; the server's list replaces it after the refresh.
  const [aliases, setOptimisticActive] = React.useOptimistic(
    data.aliases,
    (list, change: { id: string; active: boolean }) =>
      list.map((a) =>
        a.id === change.id ? { ...a, active: change.active } : a,
      ),
  );
  const busy = (id: string) => pending && busyId === id;

  const refresh = () => startTransition(() => router.refresh());

  /** Runs a change and reloads the server data, in one transition. */
  function act(
    id: string,
    action: () => Promise<void>,
    optimistic?: { id: string; active: boolean },
  ) {
    setBusyId(id);
    startTransition(async () => {
      if (optimistic) setOptimisticActive(optimistic);
      try {
        await action();
        router.refresh();
      } catch (error) {
        toast.error(aliasErrorMessage(error, t));
      }
    });
  }

  const toggleActive = (alias: ApiMerchantAlias, active: boolean) =>
    act(
      alias.id,
      async () => {
        await setAliasActive(alias, active, gql);
        toast.success(
          t(active ? 'aliases.toasts.activated' : 'aliases.toasts.deactivated'),
        );
      },
      { id: alias.id, active },
    );

  const askDeleteAlias = (alias: ApiMerchantAlias) =>
    setConfirm({
      title: t('aliases.deleteDialog.title', { name: alias.displayName }),
      description: t('aliases.deleteDialog.description'),
      confirmLabel: t('aliases.deleteDialog.confirm'),
      destructive: true,
      onConfirm: () =>
        act(alias.id, async () => {
          await deleteAlias(alias.id, gql);
          toast.success(t('aliases.toasts.deleted'));
        }),
    });

  const askDeleteRule = (rule: ApiMerchantRule) =>
    setConfirm({
      title: t('aliases.rules.deleteTitle', { pattern: rule.pattern }),
      description: t('aliases.rules.deleteDescription'),
      confirmLabel: t('aliases.rules.confirm'),
      destructive: true,
      onConfirm: () =>
        act(rule.id, async () => {
          await deleteRule(rule.id, gql);
          toast.success(t('aliases.toasts.ruleDeleted'));
        }),
    });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="mb-1 text-[32px] font-bold text-on-background">
              {t('aliases.title')}
            </h1>
            <p className="text-sm text-on-surface-variant">
              {t('aliases.subtitle')}
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => setDialog({ alias: null })}
          >
            <Plus aria-hidden /> {t('aliases.new')}
          </Button>
        </div>
        <Button variant="link" asChild className="self-start">
          <Link href="/transactions/categorize">
            <Tags aria-hidden /> {t('aliases.categorizeLink')}
          </Link>
        </Button>

        {aliases.length === 0 ? (
          <EmptyState
            icon={Text}
            title={t('aliases.emptyTitle')}
            description={t('aliases.emptyDescription')}
          />
        ) : (
          <section className="flex flex-col gap-3">
            <p className="px-1 text-xs text-on-surface-variant">
              {t('aliases.count', { count: aliases.length })}
            </p>
            {aliases.map((alias) => (
              <AliasCard
                key={alias.id}
                alias={alias}
                busy={busy(alias.id)}
                onToggleActive={(active) => toggleActive(alias, active)}
                onEdit={() => setDialog({ alias })}
                onDelete={() => askDeleteAlias(alias)}
              />
            ))}
          </section>
        )}
      </div>

      <RuleList
        rules={data.rules}
        busyId={pending ? busyId : null}
        onDelete={askDeleteRule}
      />

      {dialog ? (
        <AliasDialog
          alias={dialog.alias}
          categories={data.categories}
          onClose={() => setDialog(null)}
          onSaved={(saved, created) => {
            setDialog(null);
            toast.success(
              t(created ? 'aliases.toasts.created' : 'aliases.toasts.updated', {
                name: saved.displayName,
              }),
            );
            refresh();
          }}
        />
      ) : null}
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
