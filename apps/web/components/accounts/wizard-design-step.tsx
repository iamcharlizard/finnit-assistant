'use client';

import { useTranslations } from 'next-intl';

import { previewColors, type DesignValue } from '@/lib/accounts/form';
import type { CardPreview } from '@/lib/accounts/view';
import { AccountCardVisual } from './account-card-visual';
import { DesignEditor } from './design-editor';

/** Step 4 (and the edit dialog): the card's look with a live preview. */
export function WizardDesignStep({
  preview,
  design,
  onChange,
  holderName,
  intro,
}: {
  preview: CardPreview;
  design: DesignValue;
  onChange: (design: DesignValue) => void;
  holderName: string;
  intro?: string;
}) {
  const t = useTranslations('accounts.design');
  const colors = previewColors(design);
  return (
    <div className="flex flex-col gap-4">
      {intro ? (
        <p className="text-sm text-on-surface-variant">{intro}</p>
      ) : null}
      <figure className="flex flex-col items-center gap-2">
        <div inert className="w-full max-w-[360px]">
          <AccountCardVisual
            account={preview}
            primaryColor={colors.primaryColor}
            secondaryColor={colors.secondaryColor}
            holderName={holderName}
            className="max-w-none"
          />
        </div>
        <figcaption className="text-xs text-on-surface-variant">
          {t('preview')}
        </figcaption>
      </figure>
      <DesignEditor value={design} onChange={onChange} />
    </div>
  );
}
