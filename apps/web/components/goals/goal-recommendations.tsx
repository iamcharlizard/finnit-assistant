import { useTranslations } from 'next-intl';
import {
  AlarmClock,
  CalendarClock,
  Lightbulb,
  TriangleAlert,
} from 'lucide-react';

import type { GoalDetailView } from '@/lib/goals/view';

/** Tips for this goal from goalRecommendations and its due date. */
export function GoalRecommendations({ detail }: { detail: GoalDetailView }) {
  const t = useTranslations('goals.recommendations');
  const tips: {
    key: string;
    icon: typeof Lightbulb;
    text: string;
    tone?: 'warn';
  }[] = [];
  if (detail.atRisk) {
    tips.push({
      key: 'atRisk',
      icon: TriangleAlert,
      text: t('atRisk'),
      tone: 'warn',
    });
  }
  if (detail.dueSoon) {
    tips.push({
      key: 'dueSoon',
      icon: AlarmClock,
      text: t('dueSoon'),
      tone: 'warn',
    });
  }
  if (detail.needed) {
    tips.push({
      key: 'needed',
      icon: CalendarClock,
      text: detail.needed.label,
    });
  }
  if (detail.twelveMonths) {
    tips.push({ key: 'twelve', icon: Lightbulb, text: detail.twelveMonths });
  }
  if (detail.card.status === 'reached') {
    tips.push({ key: 'reached', icon: Lightbulb, text: t('reached') });
  } else if (detail.card.status === 'noDueDate') {
    tips.push({ key: 'noDue', icon: Lightbulb, text: t('noDueDate') });
  }
  if (tips.length === 0) return null;

  return (
    <section aria-labelledby="goal-tips-title" className="flex flex-col gap-2">
      <h3 id="goal-tips-title" className="text-sm font-bold text-on-background">
        {t('title')}
      </h3>
      <ul className="flex flex-col gap-2">
        {tips.map(({ key, icon: Icon, text, tone }) => (
          <li
            key={key}
            className={
              tone === 'warn'
                ? 'flex gap-2.5 rounded-input bg-highlight/8 p-3 text-sm text-on-background'
                : 'flex gap-2.5 rounded-input bg-accent-neon/10 p-3 text-sm text-on-background'
            }
          >
            <Icon
              aria-hidden
              className={
                tone === 'warn'
                  ? 'mt-0.5 size-4 shrink-0 text-highlight'
                  : 'mt-0.5 size-4 shrink-0 text-violet-ink'
              }
            />
            {text}
          </li>
        ))}
      </ul>
    </section>
  );
}
