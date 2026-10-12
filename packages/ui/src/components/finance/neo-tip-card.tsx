'use client';

import { Lightbulb, Star } from 'lucide-react';

import { cn } from '../../lib/utils';

interface NeoTipCardProps {
  title: string;
  body: string;
  /** Inline highlighted amount/text rendered after `body`. */
  highlight?: string;
  bodyAfterHighlight?: string;
  /** The action button is only rendered when a label is given. */
  actionLabel?: string;
  onActionClick?: () => void;
  className?: string;
}

function NeoTipCard({
  title,
  body,
  highlight,
  bodyAfterHighlight,
  actionLabel,
  onActionClick,
  className,
}: NeoTipCardProps) {
  return (
    <aside
      className={cn(
        'relative overflow-hidden rounded-2xl border border-l-[3px] border-glass-border border-l-tertiary bg-glass p-5 shadow-[0_0_20px_color-mix(in_srgb,var(--tertiary)_18%,transparent)] backdrop-blur-md',
        className,
      )}
    >
      <Lightbulb
        aria-hidden
        className="pointer-events-none absolute -top-2 -right-2 size-16 text-tertiary opacity-[0.07]"
      />

      <h3 className="mb-2 flex items-center gap-2 text-[15px] font-bold text-tertiary">
        <Star aria-hidden className="size-[18px] fill-current" />
        {title}
      </h3>

      <p className="mb-3.5 text-[13px] leading-5 text-on-surface-variant">
        {body}
        {highlight ? (
          <strong className="font-bold text-tertiary">{highlight}</strong>
        ) : null}
        {bodyAfterHighlight ?? ''}
      </p>

      {actionLabel ? (
        <button
          type="button"
          onClick={onActionClick}
          className="min-h-11 rounded-[10px] border border-tertiary/30 bg-tertiary/10 px-4 py-2 text-[13px] font-medium text-tertiary outline-none transition-colors hover:bg-tertiary/15 focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {actionLabel}
        </button>
      ) : null}
    </aside>
  );
}

export { NeoTipCard, type NeoTipCardProps };
