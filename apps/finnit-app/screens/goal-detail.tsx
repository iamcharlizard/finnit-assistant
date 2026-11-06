import * as React from 'react';
import { Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslations } from 'use-intl';
import { ChartLine, Link2, Pencil, Trash2 } from 'lucide-react-native';

import { todayKey } from '@finnit/core/finance/dates';
import {
  addContribution,
  deleteGoal,
  deleteGoalWithContributions,
  goalErrorMessage,
  hasContributionsError,
  removeContribution,
} from '@finnit/core/goals/api';
import { formOfGoal, hasErrors, newContributionForm, validateContributionForm, type ContributionErrors } from '@finnit/core/goals/form';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Card } from '@finnit/ui-native/components/ui/card';
import { DatePicker } from '@finnit/ui-native/components/ui/date-picker';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { MoneyInput } from '@finnit/ui-native/components/ui/money-input';
import { Text } from '@finnit/ui-native/components/ui/text';
import { toast } from '@finnit/ui-native/components/ui/toaster';

import { GoalStatusBadge, ProgressRing } from '@/components/goals/goal-parts';
import { GoalSheet } from '@/components/goals/goal-sheet';
import { Screen } from '@/components/shell/screen';
import { useGoals } from '@/lib/goals/use-goals';
import { useGql } from '@/lib/graphql/runner';
import { useLocalizer } from '@/lib/i18n/i18n-provider';

/** One goal: progress, projection, contributions (add, remove), edit and delete. */
export function GoalDetailScreen() {
  const { goalId } = useLocalSearchParams<{ goalId: string }>();
  const t = useTranslations();
  const l = useLocalizer();
  const gql = useGql();
  const router = useRouter();
  const today = todayKey();
  const { view, error, loading, reload } = useGoals(goalId);
  const detail = view?.detail ?? null;
  const [editing, setEditing] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState(() => newContributionForm(today));
  const [formErrors, setFormErrors] = React.useState<ContributionErrors>({});
  const [adding, setAdding] = React.useState(false);

  async function add() {
    const found = validateContributionForm(form, today);
    setFormErrors(found);
    if (hasErrors(found)) return;
    setAdding(true);
    try {
      await addContribution(goalId, form, gql);
      toast.success(t('goals.toasts.contributionAdded'));
      setForm(newContributionForm(today));
      await reload();
    } catch (e) {
      toast.error(goalErrorMessage(e, l.t));
    } finally {
      setAdding(false);
    }
  }

  function askRemove(id: string, amount: string, date: string) {
    Alert.alert(t('goals.contributions.removeTitle'), t('goals.contributions.removeDescription', { amount, date }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('goals.contributions.removeConfirm'),
        style: 'destructive',
        onPress: async () => {
          setBusyId(id);
          try {
            await removeContribution(id, gql);
            toast.success(t('goals.toasts.contributionRemoved', { amount }));
            await reload();
          } catch (e) {
            toast.error(goalErrorMessage(e, l.t));
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  }

  function askDelete() {
    if (!detail) return;
    const { card } = detail;
    const withContributions = detail.contributions.length > 0;
    Alert.alert(
      t('goals.delete.title', { name: card.name }),
      withContributions ? t('goals.delete.withContributions', { amount: card.saved }) : t('goals.delete.description'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: withContributions ? t('goals.delete.confirmAll') : t('goals.delete.confirm'),
          style: 'destructive',
          onPress: async () => {
            setBusyId(card.id);
            try {
              try {
                await deleteGoal(card.id, gql);
              } catch (e) {
                if (!hasContributionsError(e)) throw e;
                await deleteGoalWithContributions(card.id, gql);
              }
              toast.success(t('goals.toasts.deleted', { name: card.name }));
              router.back();
            } catch (e) {
              toast.error(goalErrorMessage(e, l.t));
              setBusyId(null);
            }
          },
        },
      ],
    );
  }

  const card = detail?.card;
  return (
    <Screen title={card?.name ?? t('goals.title')} back withBottomNav={false} loading={loading && !view} error={!view ? error : undefined} onRefresh={reload}>
      {detail && card ? (
        <TwView className="gap-4">
          <Card className="gap-4">
            <GoalStatusBadge status={card.status} />
            <TwView className="flex-row items-center gap-4">
              <ProgressRing percent={card.percent} reached={card.status === 'reached'} size={96} label={t('goals.card.progressLabel', { percent: card.percent })} />
              <TwView className="min-w-0 flex-1 gap-1">
                <Text className="text-xs text-on-surface-variant">{t('goals.detail.saved')}</Text>
                <Text weight="bold" className="text-2xl" style={{ fontVariant: ['tabular-nums'] }}>
                  {card.saved}
                </Text>
                <Text className="text-xs text-on-surface-variant">
                  {t('goals.detail.target')}: {card.target}
                </Text>
                {card.status !== 'reached' ? (
                  <Text className="text-xs text-on-surface-variant">
                    {t('goals.detail.remaining')}: {card.remaining}
                  </Text>
                ) : null}
              </TwView>
            </TwView>
            <Text className="text-xs text-on-surface-variant">
              {card.dueLabel}
              {card.daysLabel ? ` · ${card.daysLabel}` : ''}
            </Text>
            <TwView className="flex-row flex-wrap gap-2">
              <Button variant="outline" size="sm" icon={Pencil} label={t('goals.detail.edit')} onPress={() => setEditing(true)} />
              <Button variant="destructive" size="sm" icon={Trash2} label={t('goals.detail.delete')} disabled={busyId === card.id} onPress={askDelete} />
            </TwView>
          </Card>

          <Card className="gap-2">
            <TwView className="flex-row items-center gap-2">
              <Icon icon={ChartLine} size={16} color="--tertiary" />
              <Text weight="bold" className="text-sm">
                {t('goals.projection.title')}
              </Text>
            </TwView>
            <Text weight="medium" className="text-base">
              {detail.projection.headline}
            </Text>
            {detail.projection.detail ? <Text className="text-xs text-on-surface-variant">{detail.projection.detail}</Text> : null}
            <Text className="text-xs text-on-surface-variant">{t('goals.projection.monthlyHint', { amount: detail.averageMonthly })}</Text>
          </Card>

          <Card className="gap-3">
            <Text accessibilityRole="header" weight="bold" className="text-sm">
              {t('goals.detail.contributions', { count: detail.contributions.length })}
            </Text>
            {detail.canContribute ? (
              <TwView className="gap-3 rounded-input border border-outline-70 p-3">
                <MoneyInput
                  label={t('goals.contributions.amount')}
                  value={form.amount}
                  onValueChange={(amount) => setForm((f) => ({ ...f, amount }))}
                  currency={card.goal.currency}
                  error={formErrors.amount ? t(`goals.validation.${formErrors.amount}`) : undefined}
                />
                <DatePicker
                  label={t('goals.contributions.date')}
                  locale={l.locale}
                  value={form.date || undefined}
                  max={today}
                  onChange={(day) => setForm((f) => ({ ...f, date: day ?? '' }))}
                  error={formErrors.date ? t(`goals.validation.${formErrors.date}`) : undefined}
                  closeLabel={t('common.close')}
                />
                <Button variant="secondary" label={adding ? t('goals.contributions.adding') : t('goals.contributions.add')} disabled={adding} onPress={add} />
              </TwView>
            ) : (
              <Text className="text-sm text-on-surface-variant">{t('goals.detail.reachedNote')}</Text>
            )}
            {detail.contributions.length === 0 ? (
              <Text className="text-sm text-on-surface-variant">{t('goals.contributions.empty')}</Text>
            ) : (
              detail.contributions.map((item) => (
                <TwView key={item.id} className="flex-row items-center gap-3 border-t border-outline-60 py-2">
                  <TwView className="min-w-0 flex-1">
                    <Text weight="bold" className="text-sm" style={{ fontVariant: ['tabular-nums'] }}>
                      {item.amount}
                    </Text>
                    <TwView className="flex-row items-center gap-1">
                      <Text className="text-xs text-on-surface-variant">{item.dateLabel}</Text>
                      {item.linked ? (
                        <>
                          <Icon icon={Link2} size={12} color="--on-surface-variant" />
                          <Text className="text-xs text-on-surface-variant">{t('goals.contributions.linked')}</Text>
                        </>
                      ) : null}
                    </TwView>
                  </TwView>
                  <Button
                    variant="ghost"
                    size="icon"
                    icon={Trash2}
                    disabled={busyId === item.id}
                    label={t('goals.contributions.remove', { amount: item.amount, date: item.dateLabel })}
                    onPress={() => askRemove(item.id, item.amount, item.dateLabel)}
                  />
                </TwView>
              ))
            )}
          </Card>
          {editing ? (
            <GoalSheet
              target={{ mode: 'edit', id: card.id, initial: formOfGoal(card.goal) }}
              initial={formOfGoal(card.goal)}
              onClose={() => setEditing(false)}
              onSaved={(result, name) => {
                setEditing(false);
                if (!result.changed) {
                  toast.info(t('goals.toasts.noChanges'));
                  return;
                }
                toast.success(t('goals.toasts.updated', { name }));
                void reload();
              }}
            />
          ) : null}
        </TwView>
      ) : null}
    </Screen>
  );
}
