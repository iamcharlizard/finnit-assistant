import { useTranslations } from 'next-intl';

/** Placeholder cards while suggestions are detected. */
export function SuggestionsSkeleton() {
  const t = useTranslations('recurring.suggestions');
  return (
    <div role="status" className="flex flex-col gap-3">
      <p className="text-sm text-on-surface-variant">{t('loading')}</p>
      <div aria-hidden className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-52 animate-pulse rounded-card bg-track" />
        ))}
      </div>
    </div>
  );
}
