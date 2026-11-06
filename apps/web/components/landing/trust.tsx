import { HandHeart, KeyRound, LockKeyhole } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { LandingSectionHeading } from './section-heading';

const POINTS = [
  { key: 'files', icon: LockKeyhole },
  { key: 'credentials', icon: KeyRound },
  { key: 'control', icon: HandHeart },
] as const;

export async function Trust() {
  const t = await getTranslations('landing.trust');
  return (
    <section
      id="trust"
      aria-labelledby="trust-title"
      className="scroll-mt-28 px-6 py-14 @4xl:py-20"
    >
      <div className="mx-auto max-w-6xl rounded-[36px] border border-outline bg-surface/70 p-8 shadow-elevation backdrop-blur-sm @2xl:p-12">
        <LandingSectionHeading
          id="trust-title"
          eyebrow={t('eyebrow')}
          title={t('title')}
        />
        <ul className="mt-10 grid gap-8 @3xl:grid-cols-3">
          {POINTS.map(({ key, icon: Icon }) => (
            <li
              key={key}
              className="landing-reveal border-t border-outline pt-6"
            >
              <Icon aria-hidden className="size-6 text-facet-2" />
              <h3 className="mt-4 text-lg font-bold text-on-background">
                {t(`${key}.title`)}
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed text-on-surface-variant">
                {t(`${key}.body`)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
