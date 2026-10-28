'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { toast } from '@finnit/ui/components/ui/toaster';
import { cn } from '@finnit/ui/lib/utils';

import {
  ConfirmDialog,
  type ConfirmRequest,
} from '@/components/admin/confirm-dialog';
import {
  deleteGoal,
  deleteGoalWithContributions,
  goalErrorMessage,
  hasContributionsError,
  removeContribution,
} from '@/lib/goals/api';
import type {
  ContributionItem,
  GoalCardView,
  GoalsScreenView,
} from '@/lib/goals/view';
import { goalsHref } from '@/lib/goals/view';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import { GoalCard } from './goal-card';
import { GoalDetailSheet } from './goal-detail-sheet';
import {
  GoalDialog,
  type GoalDialogSubject,
  type GoalSaved,
} from './goal-dialog';
import { GoalsAttention } from './goals-attention';
import { GoalsEmpty } from './goals-empty';
import { GoalsSummary } from './goals-summary';

/** "Metas de ahorro": every goal as a card, totals, and the open goal's detail. */
export function GoalsScreen({ view }: { view: GoalsScreenView }) {
  const router = useRouter();
  const { t } = useLocalizer();
  const [pending, startTransition] = React.useTransition();
  const [openId, setOpenId] = React.useState<string | null>(
    view.detail?.card.id ?? null,
  );
  // Back/forward changes ?goal= without our handlers: follow it.
  const param = useSearchParams().get('goal');
  const [lastParam, setLastParam] = React.useState(param);
  if (param !== lastParam) {
    setLastParam(param);
    setOpenId(param);
  }
  const [dialog, setDialog] = React.useState<GoalDialogSubject | null>(null);
  const [confirm, setConfirm] = React.useState<ConfirmRequest | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const detail = view.detail?.card.id === openId ? view.detail : null;
  const refresh = () => startTransition(() => router.refresh());
  const fail = (error: unknown) => toast.error(goalErrorMessage(error, t));

  function open(id: string) {
    setOpenId(id);
    startTransition(() => router.push(goalsHref(id), { scroll: false }));
  }

  function close() {
    setOpenId(null);
    startTransition(() => router.push(goalsHref(), { scroll: false }));
  }

  function onSaved(result: GoalSaved) {
    const subject = dialog;
    setDialog(null);
    if (!result.changed) {
      toast(t('goals.toasts.noChanges'));
      return;
    }
    toast.success(
      t(
        subject?.mode === 'edit'
          ? 'goals.toasts.updated'
          : 'goals.toasts.created',
        {
          name: result.name,
        },
      ),
    );
    if (result.initialError) {
      toast.error(
        t('goals.toasts.initialFailed', { error: result.initialError }),
      );
    }
    if (subject?.mode === 'create' && result.goalId) open(result.goalId);
    else refresh();
  }

  async function runDelete(card: GoalCardView, withContributions: boolean) {
    setConfirm(null);
    setBusyId(card.id);
    try {
      if (withContributions) await deleteGoalWithContributions(card.id, gql);
      else await deleteGoal(card.id, gql);
      toast.success(t('goals.toasts.deleted', { name: card.name }));
      if (openId === card.id) close();
      else refresh();
    } catch (error) {
      if (!withContributions && hasContributionsError(error)) {
        askDelete(card, true);
      } else {
        fail(error);
        refresh();
      }
    } finally {
      setBusyId(null);
    }
  }

  function askDelete(
    card: GoalCardView,
    withContributions = card.goal.currentAmount > 0,
  ) {
    setConfirm({
      title: t('goals.delete.title', { name: card.name }),
      description: withContributions
        ? t('goals.delete.withContributions', { amount: card.saved })
        : t('goals.delete.description'),
      confirmLabel: withContributions
        ? t('goals.delete.confirmAll')
        : t('goals.delete.confirm'),
      destructive: true,
      onConfirm: () => void runDelete(card, withContributions),
    });
  }

  function askRemoveContribution(item: ContributionItem) {
    setConfirm({
      title: t('goals.contributions.removeTitle'),
      description: t('goals.contributions.removeDescription', {
        amount: item.amount,
        date: item.dateLabel,
      }),
      confirmLabel: t('goals.contributions.removeConfirm'),
      destructive: true,
      onConfirm: async () => {
        setConfirm(null);
        setBusyId(item.id);
        try {
          await removeContribution(item.id, gql);
          toast.success(
            t('goals.toasts.contributionRemoved', { amount: item.amount }),
          );
          refresh();
        } catch (error) {
          fail(error);
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div className="flex flex-col gap-1">
          <h1 className="text-[28px] leading-9 font-bold text-brand-ink sm:text-[32px] sm:leading-10">
            {t('goals.title')}
          </h1>
          <p className="text-[15px] text-on-surface-variant">
            {t('goals.subtitle')}
          </p>
        </div>
        {view.cards.length > 0 ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => setDialog({ mode: 'create' })}
          >
            <Plus aria-hidden /> {t('goals.new')}
          </Button>
        ) : null}
      </header>

      {view.cards.length === 0 ? (
        <GoalsEmpty onCreate={() => setDialog({ mode: 'create' })} />
      ) : (
        <>
          {view.summary ? <GoalsSummary summary={view.summary} /> : null}
          <GoalsAttention dueSoon={view.dueSoon} atRisk={view.atRisk} />
          <div
            aria-busy={pending}
            className={cn(
              'grid gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-3',
              pending && 'opacity-70',
            )}
          >
            {view.cards.map((card) => (
              <GoalCard
                key={card.id}
                card={card}
                selected={card.id === openId}
                onOpen={() => open(card.id)}
              />
            ))}
          </div>
        </>
      )}

      <GoalDetailSheet
        open={openId !== null}
        detail={detail}
        today={view.today}
        busyId={busyId}
        onClose={close}
        onEdit={() =>
          detail && setDialog({ mode: 'edit', goal: detail.card.goal })
        }
        onDelete={() => detail && askDelete(detail.card)}
        onContributionAdded={() => {
          toast.success(t('goals.toasts.contributionAdded'));
          refresh();
        }}
        onRemoveContribution={askRemoveContribution}
      />

      {dialog ? (
        <GoalDialog
          subject={dialog}
          defaultCurrency={view.currency}
          onClose={() => setDialog(null)}
          onSaved={onSaved}
        />
      ) : null}
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
