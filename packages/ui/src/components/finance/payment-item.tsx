'use client';

import type { LucideIcon } from 'lucide-react';

import { cn } from '../../lib/utils';

type PaymentStatus = 'pending' | 'scheduled' | 'paid';

interface PaymentItemProps {
  title: string;
  amount: string;
  status: PaymentStatus;
  timeLabel: string;
  icon: LucideIcon;
  iconBg: string;
  iconTint?: string;
  onClick?: () => void;
  className?: string;
}

const STATUS_CONFIG: Record<
  PaymentStatus,
  { label: string; container: string; badge: string; amount: string }
> = {
  pending: {
    label: 'PENDIENTE',
    container:
      'border-[#00f5ff]/30 bg-[#00f5ff]/6 dark:border-[#00f5ff]/25 dark:bg-[#00f5ff]/8',
    badge:
      'bg-brand text-brand-foreground dark:bg-[#00f5ff] dark:text-[#00363a]',
    amount: 'text-brand-ink dark:text-[#00f5ff]',
  },
  scheduled: {
    label: 'PROGRAMADO',
    container: 'border-glass-border bg-track',
    badge: 'bg-track text-on-background',
    amount: 'text-on-background',
  },
  paid: {
    label: 'PAGADO',
    container: 'border-glass-border bg-transparent',
    badge:
      'bg-green-500/15 text-green-800 dark:bg-green-500/20 dark:text-green-400',
    amount: 'text-on-background',
  },
};

function PaymentItem({
  title,
  amount,
  status,
  timeLabel,
  icon: Icon,
  iconBg,
  iconTint = '#ffffff',
  onClick,
  className,
}: PaymentItemProps) {
  const config = STATUS_CONFIG[status];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-11 w-full items-center gap-3 rounded-2xl border p-3 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50',
        config.container,
        className,
      )}
    >
      <span
        className="flex size-12 shrink-0 items-center justify-center rounded-chip"
        style={{ backgroundColor: iconBg }}
      >
        <Icon aria-hidden className="size-[22px]" style={{ color: iconTint }} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-on-background">
          {title}
        </span>
        <span className="mt-1 flex items-center gap-1.5">
          <span
            className={cn(
              'rounded-full px-1.5 py-0.5 text-[8px] font-bold tracking-wide',
              config.badge,
            )}
          >
            {config.label}
          </span>
          <span className="text-[11px] text-on-surface-variant">
            {timeLabel}
          </span>
        </span>
      </span>
      <span className={cn('text-sm font-bold', config.amount)}>{amount}</span>
    </button>
  );
}

export { PaymentItem, type PaymentItemProps, type PaymentStatus };
