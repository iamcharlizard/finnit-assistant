import {
  CalendarClock,
  Landmark,
  ReceiptText,
  Scale,
  Smartphone,
  Tags,
  type LucideIcon,
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { cn } from '@finnit/ui/lib/utils';

import { LandingSectionHeading } from './section-heading';

type FeatureKey =
  | 'receipts'
  | 'screenshots'
  | 'categorize'
  | 'banks'
  | 'debts'
  | 'reconcile';

/** Bento: the two flagship AI captures lead, reconciliation closes wide. */
const FEATURES: { key: FeatureKey; icon: LucideIcon; className: string }[] = [
  { key: 'receipts', icon: ReceiptText, className: '@3xl:col-span-2' },
  { key: 'screenshots', icon: Smartphone, className: '' },
  { key: 'categorize', icon: Tags, className: '' },
  { key: 'banks', icon: Landmark, className: '' },
  { key: 'debts', icon: CalendarClock, className: '' },
  { key: 'reconcile', icon: Scale, className: '@3xl:col-span-3' },
];

export async function AiFeatures() {
  const t = await getTranslations('landing.features');
  return (
    <section
      id="features"
      aria-labelledby="features-title"
      className="scroll-mt-28 px-6 py-14 @4xl:py-20"
    >
      <div className="mx-auto max-w-6xl">
        <LandingSectionHeading
          id="features-title"
          eyebrow={t('eyebrow')}
          title={t('title')}
          lead={t('lead')}
        />
        <ul className="mt-12 grid gap-4 @3xl:grid-cols-3">
          {FEATURES.map(({ key, icon: Icon, className }, index) => (
            <li
              key={key}
              className={cn(
                'landing-reveal group relative overflow-hidden rounded-card border border-outline bg-surface/80 p-7 shadow-elevation backdrop-blur-sm transition-colors hover:border-facet-2/50',
                className,
              )}
            >
              {/* A facet in the corner, brighter on the lead card. */}
              <svg
                aria-hidden
                viewBox="0 0 100 87"
                className={cn(
                  'absolute -top-6 -right-6 size-32 rotate-12 transition-transform duration-500 group-hover:rotate-[24deg]',
                  index === 0 ? 'opacity-30' : 'opacity-10',
                )}
              >
                <path
                  d="M50 0L100 87H0Z"
                  fill={index === 0 ? 'var(--ai)' : 'var(--facet-2)'}
                />
              </svg>
              <span
                className={cn(
                  'flex size-12 items-center justify-center rounded-2xl',
                  index === 0
                    ? 'bg-ai/15 text-ai-ink'
                    : 'bg-facet-2/12 text-facet-3 dark:text-facet-1',
                )}
              >
                <Icon aria-hidden className="size-6" />
              </span>
              <h3 className="mt-5 text-xl font-bold tracking-tight text-on-background">
                {t(`${key}.title`)}
              </h3>
              <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-on-surface-variant">
                {t(`${key}.body`)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
