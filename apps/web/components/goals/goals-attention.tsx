import { useTranslations } from 'next-intl';
import { TriangleAlert } from 'lucide-react';

/** Goals due within 30 days and goals at risk (goalRecommendations). */
export function GoalsAttention({
  dueSoon,
  atRisk,
}: {
  dueSoon: string[];
  atRisk: string[];
}) {
  const t = useTranslations('goals.attention');
  if (dueSoon.length === 0 && atRisk.length === 0) return null;
  return (
    <section
      aria-label={t('title')}
      className="flex gap-3 rounded-card border border-highlight/25 bg-highlight/5 p-4"
    >
      <TriangleAlert
        aria-hidden
        className="mt-0.5 size-5 shrink-0 text-highlight"
      />
      <div className="flex min-w-0 flex-col gap-1 text-sm text-on-background">
        <h2 className="font-bold">{t('title')}</h2>
        {dueSoon.length > 0 ? (
          <p>
            {t('dueSoon', { count: dueSoon.length, names: dueSoon.join(', ') })}
          </p>
        ) : null}
        {atRisk.length > 0 ? (
          <p>
            {t('atRisk', { count: atRisk.length, names: atRisk.join(', ') })}
          </p>
        ) : null}
      </div>
    </section>
  );
}
