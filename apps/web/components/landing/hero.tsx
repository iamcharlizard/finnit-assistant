import { Building2, ReceiptText, Smartphone, Sparkles } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { AiCaptureDemo } from './ai-capture-demo';
import { FacetBackdrop } from './facet-backdrop';
import { HeroRotator } from './hero-rotator';
import { WaitlistForm } from './waitlist-form';

const SLIDES = ['photo', 'screenshot', 'bank', 'ai'] as const;

export async function Hero({ source }: { source?: string }) {
  const t = await getTranslations('landing.hero');
  const slides = SLIDES.map((key) => ({
    key,
    title: t(`slides.${key}.title`),
    lead: t(`slides.${key}.lead`),
  }));
  const chips = [
    { icon: ReceiptText, label: t('stats.receipts') },
    { icon: Smartphone, label: t('stats.screens') },
    { icon: Building2, label: t('stats.banks') },
  ];
  return (
    <section
      id="waitlist"
      className="relative isolate scroll-mt-28 px-6 pt-14 pb-20 @4xl:pt-20 @4xl:pb-28"
    >
      <FacetBackdrop />
      <div className="mx-auto grid max-w-6xl items-center gap-14 @4xl:grid-cols-[1fr_1.1fr]">
        <div>
          <p
            className="landing-rise inline-flex items-center gap-2 rounded-full border border-ai/40 bg-ai/10 px-3.5 py-1.5 text-xs font-bold tracking-wide text-on-background"
            style={{ '--i': 0 } as React.CSSProperties}
          >
            <Sparkles aria-hidden className="size-3.5 text-ai-ink" />
            {t('eyebrow')}
          </p>
          <div
            className="landing-rise"
            style={{ '--i': 1 } as React.CSSProperties}
          >
            <HeroRotator
              slides={slides}
              accent={t('titleAccent')}
              srTitle={t('srTitle')}
              label={t('slidesLabel')}
              showLabel={slides.map((slide) =>
                t('showSlide', { title: slide.title }),
              )}
            />
          </div>
          {/* Phones use the form at the end, so the illustration stays close. */}
          <div
            className="landing-rise mt-8 hidden max-w-[34rem] @4xl:block"
            style={{ '--i': 3 } as React.CSSProperties}
          >
            <WaitlistForm placement="hero" source={source} />
          </div>
          <ul
            className="landing-rise mt-8 flex flex-wrap gap-2"
            style={{ '--i': 4 } as React.CSSProperties}
          >
            {chips.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="inline-flex items-center gap-2 rounded-full border border-outline bg-surface/60 px-3 py-1.5 text-xs font-medium text-on-surface-variant"
              >
                <Icon aria-hidden className="size-3.5 text-facet-2" />
                {label}
              </li>
            ))}
          </ul>
        </div>
        {/* Illustration on the left from @4xl; below the text when stacked. */}
        <div
          className="landing-rise @4xl:order-first"
          style={{ '--i': 3 } as React.CSSProperties}
        >
          <AiCaptureDemo />
        </div>
      </div>
    </section>
  );
}
