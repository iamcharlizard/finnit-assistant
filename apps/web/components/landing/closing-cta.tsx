import { getTranslations } from 'next-intl/server';

import { FacetMark } from './facet-mark';
import { WaitlistForm } from './waitlist-form';

export async function ClosingCta({ source }: { source?: string }) {
  const t = await getTranslations('landing.cta');
  return (
    <section
      id="join"
      aria-labelledby="cta-title"
      className="scroll-mt-28 px-6 py-14 @4xl:py-20"
    >
      <div className="relative isolate mx-auto max-w-4xl overflow-hidden rounded-[40px] border border-glass-border bg-glass px-6 py-14 text-center shadow-elevation glass @2xl:px-14">
        <div
          aria-hidden
          className="absolute -top-24 left-1/2 -z-10 size-80 -translate-x-1/2 rounded-full bg-ai/20 blur-3xl"
        />
        <FacetMark className="landing-reveal mx-auto w-20" />
        <h2
          id="cta-title"
          className="mt-8 text-[32px] leading-[1.1] font-bold tracking-[-0.025em] text-on-background @2xl:text-[44px]"
        >
          {t('title')}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-on-surface-variant">
          {t('lead')}
        </p>
        <WaitlistForm
          placement="footer"
          source={source}
          className="mx-auto mt-8 max-w-lg text-left"
        />
      </div>
    </section>
  );
}
