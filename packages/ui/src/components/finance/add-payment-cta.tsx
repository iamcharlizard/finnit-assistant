'use client';

import { CreditCard } from 'lucide-react';

import { cn } from '../../lib/utils';

interface AddPaymentCtaProps {
  title?: string;
  actionLabel?: string;
  onClick?: () => void;
  className?: string;
}

function AddPaymentCta({
  title = 'New recurring expense?',
  actionLabel = 'Add payment',
  onClick,
  className,
}: AddPaymentCtaProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-on-background/12 px-6 py-7',
        className,
      )}
    >
      <CreditCard aria-hidden className="size-8 text-on-background/20" />
      <p className="text-center text-[15px] font-bold text-on-surface-variant">
        {title}
      </p>
      <button
        type="button"
        onClick={onClick}
        className="mt-1 min-h-11 rounded-full bg-brand px-7 py-3 text-sm font-bold text-brand-foreground shadow-[0_0_18px_rgba(0,245,255,0.5)] outline-none transition-opacity hover:opacity-90 focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {actionLabel}
      </button>
    </div>
  );
}

export { AddPaymentCta, type AddPaymentCtaProps };
