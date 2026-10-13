import { useTranslations } from 'next-intl';
import { Plus, Target } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';

/** No goals yet: what they are for and a button to create the first one. */
export function GoalsEmpty({ onCreate }: { onCreate: () => void }) {
  const t = useTranslations('goals.empty');
  return (
    <section className="flex flex-col items-center gap-3 rounded-card border border-dashed border-outline px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-accent-neon/20">
        <Target aria-hidden className="size-6 text-brand-ink" />
      </span>
      <h2 className="text-lg font-bold text-on-background">{t('title')}</h2>
      <p className="max-w-sm text-sm text-on-surface-variant">
        {t('description')}
      </p>
      <Button type="button" variant="secondary" onClick={onCreate}>
        <Plus aria-hidden /> {t('cta')}
      </Button>
    </section>
  );
}
