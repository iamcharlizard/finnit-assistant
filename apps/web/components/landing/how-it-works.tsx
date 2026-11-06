import { getTranslations } from 'next-intl/server';

import { cn } from '@finnit/ui/lib/utils';

import { LandingSectionHeading } from './section-heading';

const STEPS = ['step1', 'step2', 'step3'] as const;

export async function HowItWorks() {
  const t = await getTranslations('landing.how');
  return (
    <section
      id="how"
      aria-labelledby="how-title"
      className="scroll-mt-28 px-6 py-14 @4xl:py-20"
    >
      <div className="mx-auto max-w-6xl">
        <LandingSectionHeading
          id="how-title"
          eyebrow={t('eyebrow')}
          title={t('title')}
          align="center"
        />
        <ol className="relative mt-14 grid gap-10 @3xl:grid-cols-3 @3xl:gap-6">
          {STEPS.map((step, index) => (
            <li
              key={step}
              className="landing-reveal relative flex gap-5 @3xl:flex-col @3xl:items-center @3xl:gap-0 @3xl:text-center"
            >
              {index < STEPS.length - 1 ? (
                /*
                 * Joins this step's circle to the next one. Wide: across,
                 * from this circle's right edge (column center + 28px) to
                 * the next one's left edge (one column + gap later, minus
                 * both radii). Stacked: down beside the text, from this
                 * circle's bottom to the next one's top.
                 */
                <span
                  aria-hidden
                  className={cn(
                    'absolute top-14 left-[27px] h-[calc(100%-3.5rem+2.5rem)] w-0.5 bg-gradient-to-b',
                    '@3xl:top-[27px] @3xl:left-[calc(50%+28px)] @3xl:h-0.5 @3xl:w-[calc(100%+1.5rem-56px)] @3xl:bg-gradient-to-r',
                    index === 0 ? 'from-facet-2 to-ai' : 'from-ai to-facet-2',
                  )}
                />
              ) : null}
              <span
                className={cn(
                  'relative flex size-14 shrink-0 items-center justify-center rounded-full text-lg font-bold ring-[6px]',
                  index === 1
                    ? 'bg-ai text-[#1a1b22] ring-ai/20'
                    : 'bg-facet-2 text-white ring-facet-2/15',
                )}
              >
                {index + 1}
              </span>
              <div className="pt-3 @3xl:max-w-xs @3xl:pt-6">
                <h3 className="text-xl font-bold tracking-tight text-on-background">
                  {t(`${step}.title`)}
                </h3>
                <p className="mt-2 text-[15px] leading-relaxed text-on-surface-variant">
                  {t(`${step}.body`)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
