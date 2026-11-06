import * as React from 'react';
import { useRouter } from 'expo-router';
import { useTranslations } from 'use-intl';
import { Plus } from 'lucide-react-native';

import { goalErrorMessage } from '@finnit/core/goals/api';
import { newGoalForm } from '@finnit/core/goals/form';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { toast } from '@finnit/ui-native/components/ui/toaster';

import { GoalCard, GoalsEmpty, GoalsSummary } from '@/components/goals/goal-parts';
import { GoalSheet } from '@/components/goals/goal-sheet';
import { Screen } from '@/components/shell/screen';
import { useGoals } from '@/lib/goals/use-goals';
import { useLocalizer } from '@/lib/i18n/i18n-provider';

/** Metas de ahorro: every goal as a card and the totals; a tap opens the goal. */
export function GoalsScreen() {
  const t = useTranslations();
  const l = useLocalizer();
  const router = useRouter();
  const { view, error, loading, reload } = useGoals(null);
  const [creating, setCreating] = React.useState(false);
  const open = (goalId: string) => router.push({ pathname: '/planning/goals/[goalId]', params: { goalId } });

  return (
    <Screen
      title={t('goals.title')}
      subtitle={t('goals.subtitle')}
      actions={view && view.cards.length > 0 ? <Button variant="secondary" size="sm" icon={Plus} label={t('goals.new')} onPress={() => setCreating(true)} /> : undefined}
      loading={loading && !view}
      error={!view ? error : undefined}
      refreshing={loading && Boolean(view)}
      onRefresh={reload}
    >
      {view ? (
        <TwView className="gap-5">
          {view.cards.length === 0 ? (
            <GoalsEmpty onCreate={() => setCreating(true)} />
          ) : (
            <>
              {view.summary ? <GoalsSummary summary={view.summary} /> : null}
              <TwView className="gap-3">
                {view.cards.map((card) => (
                  <GoalCard key={card.id} card={card} onOpen={() => open(card.id)} />
                ))}
              </TwView>
            </>
          )}
          {creating ? (
            <GoalSheet
              target={{ mode: 'create' }}
              initial={newGoalForm(view.currency)}
              onClose={() => setCreating(false)}
              onSaved={(result, name) => {
                setCreating(false);
                toast.success(t('goals.toasts.created', { name }));
                if (result.initialFailed) {
                  toast.error(t('goals.toasts.initialFailed', { error: goalErrorMessage(result.initialFailed, l.t) }));
                }
                void reload();
                if (result.goalId) open(result.goalId);
              }}
            />
          ) : null}
        </TwView>
      ) : null}
    </Screen>
  );
}
