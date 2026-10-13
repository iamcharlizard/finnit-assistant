'use client';

import type * as React from 'react';
import { Cpu, CreditCard, EyeOff, Nfc, type LucideIcon } from 'lucide-react';

import {
  isHexColor,
  LIGHT_TEXT,
  normalizeHex,
  readableTextColor,
} from '../../lib/color';
import { cn } from '../../lib/utils';

type CardVariant = 'platinum' | 'virtual' | 'premium' | 'stealth';

interface BankPaymentCardProps {
  /** Preset look; ignored when `primaryColor` is a valid hex color. */
  variant: CardVariant;
  /**
   * Custom card color ('#RRGGBB'). Overrides `variant`. With `secondaryColor`
   * the card uses a 135° gradient; text is white or near-black, whichever
   * keeps WCAG AA contrast against the background (both stops for gradients).
   */
  primaryColor?: string;
  secondaryColor?: string;
  /** Field captions (pass translated text). */
  holderLabel?: string;
  expiryLabel?: string;
  balanceLabel?: string;
  cardTier: string;
  bankName?: string;
  maskedNumber: string;
  holderName?: string;
  expiryDate?: string;
  balance?: string;
  onClick?: () => void;
  className?: string;
}

interface CardStyle {
  surface: string;
  tier: string;
  name: string;
  number: string;
  label: string;
  value: string;
  circles: [string, string];
  icon: LucideIcon;
  iconColor: string;
}

/*
 * platinum/virtual come from the mobile BankPaymentCard; premium/stealth from
 * the PaymentCard defined inline in the mobile Cards screen.
 */
const CARD_STYLES: Record<CardVariant, CardStyle> = {
  platinum: {
    surface:
      'border-white/55 bg-[linear-gradient(135deg,rgba(255,255,255,0.45)_0%,rgba(255,255,255,0.12)_100%)] shadow-[0_10px_32px_rgba(0,0,0,0.10)] dark:bg-[linear-gradient(135deg,rgba(255,255,255,0.18)_0%,rgba(255,255,255,0.04)_100%)] dark:border-white/20',
    tier: 'text-[#00696e]/85 dark:text-[#00f5ff]/80',
    name: 'text-[#004f53] dark:text-white',
    number: 'text-[#191c1d] dark:text-white',
    label: 'text-[#3a494a]/70 dark:text-white/50',
    value: 'text-[#191c1d] dark:text-white',
    circles: ['rgba(0,245,255,0.5)', 'rgba(108,114,203,0.45)'],
    icon: CreditCard,
    iconColor: 'text-[#00696e]/50 dark:text-white/40',
  },
  virtual: {
    surface:
      'border-[#9500ca]/40 bg-[linear-gradient(135deg,rgba(149,0,202,0.22)_0%,rgba(149,0,202,0.08)_100%)] shadow-[0_10px_32px_rgba(149,0,202,0.18)]',
    tier: 'text-[#320047]/85 dark:text-[#e9b3ff]',
    name: 'text-[#9500ca] dark:text-[#e9b3ff]',
    number: 'text-[#320047] dark:text-white',
    label: 'text-[#320047]/60 dark:text-white/50',
    value: 'text-[#320047] dark:text-white',
    circles: ['rgba(149,0,202,0.5)', 'rgba(173,0,155,0.35)'],
    icon: EyeOff,
    iconColor: 'text-[#9500ca]/50 dark:text-[#e9b3ff]/50',
  },
  premium: {
    surface:
      'border-[#bfc2ff]/22 bg-[linear-gradient(135deg,rgba(108,114,203,0.38)_0%,rgba(255,171,242,0.14)_100%)] shadow-[0_8px_28px_rgba(108,114,203,0.28)]',
    tier: 'text-violet-ink',
    name: 'text-on-background',
    number: 'text-on-background',
    label: 'text-on-surface-variant',
    value: 'text-on-background',
    circles: ['rgba(108,114,203,0.6)', 'rgba(255,171,242,0.5)'],
    icon: Nfc,
    iconColor: 'text-highlight',
  },
  stealth: {
    surface: 'border-white/5 bg-[#252730] shadow-[0_4px_18px_rgba(0,0,0,0.45)]',
    tier: 'text-[#c7c5d3]/75',
    name: 'text-[#e3e1eb]/80',
    number: 'text-[#e3e1eb]/65',
    label: 'text-[#c7c5d3]/75',
    value: 'text-[#c7c5d3]/90',
    circles: ['rgba(199,197,211,0.35)', 'rgba(199,197,211,0.2)'],
    icon: Cpu,
    iconColor: 'text-[#c7c5d3]/55',
  },
};

/** Styles for a custom-colored card: text inherits the computed color. */
function customCardStyle(
  textColor: string,
): Omit<CardStyle, 'icon'> & { icon?: LucideIcon } {
  const light = textColor === LIGHT_TEXT;
  return {
    surface: light
      ? 'border-white/20 shadow-[0_10px_32px_rgba(0,0,0,0.25)]'
      : 'border-black/10 shadow-[0_10px_32px_rgba(0,0,0,0.12)]',
    tier: '',
    name: '',
    number: '',
    label: '',
    value: '',
    circles: light
      ? ['rgba(255,255,255,0.45)', 'rgba(255,255,255,0.25)']
      : ['rgba(11,12,26,0.35)', 'rgba(11,12,26,0.2)'],
    iconColor: 'opacity-70',
  };
}

function BankPaymentCard({
  variant,
  primaryColor,
  secondaryColor,
  holderLabel = 'Holder',
  expiryLabel = 'Expires',
  balanceLabel = 'Virtual balance',
  cardTier,
  bankName,
  maskedNumber,
  holderName,
  expiryDate,
  balance,
  onClick,
  className,
}: BankPaymentCardProps) {
  const primary =
    primaryColor && isHexColor(primaryColor)
      ? normalizeHex(primaryColor)
      : undefined;
  const secondary =
    primary && secondaryColor && isHexColor(secondaryColor)
      ? normalizeHex(secondaryColor)
      : undefined;
  const textColor = primary
    ? readableTextColor(secondary ? [primary, secondary] : primary)
    : undefined;

  const preset = CARD_STYLES[variant];
  const s: CardStyle = textColor
    ? { ...customCardStyle(textColor), icon: preset.icon }
    : preset;
  const Icon = s.icon;
  const customStyle: React.CSSProperties | undefined = primary
    ? {
        background: secondary
          ? `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`
          : primary,
        color: textColor,
      }
    : undefined;

  return (
    <button
      type="button"
      onClick={onClick}
      data-custom-color={primary ? '' : undefined}
      style={customStyle}
      className={cn(
        'relative flex h-[210px] w-full max-w-[360px] shrink-0 flex-col justify-between overflow-hidden rounded-[28px] border p-[22px] text-left outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-[3px] focus-visible:ring-ring/50',
        s.surface,
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-16 size-[220px] rounded-full bg-white/10"
      />

      <span className="relative flex items-start justify-between">
        <span className="flex flex-col gap-0.5">
          <span
            className={cn(
              'text-[10px] font-medium uppercase tracking-[0.25em]',
              s.tier,
            )}
          >
            {cardTier}
          </span>
          {bankName ? (
            <span className={cn('text-[19px] font-bold', s.name)}>
              {bankName}
            </span>
          ) : null}
        </span>
        <Icon aria-hidden className={cn('size-7', s.iconColor)} />
      </span>

      <span className="relative flex flex-col gap-2.5">
        <span className={cn('text-[19px] tracking-[0.18em]', s.number)}>
          {maskedNumber}
        </span>

        <span className="flex items-end justify-between">
          {balance ? (
            <CardField label={balanceLabel} value={balance} s={s} />
          ) : (
            <span className="flex gap-5">
              {holderName ? (
                <CardField label={holderLabel} value={holderName} s={s} />
              ) : null}
              {expiryDate ? (
                <CardField label={expiryLabel} value={expiryDate} s={s} />
              ) : null}
            </span>
          )}

          <span aria-hidden className="flex items-center">
            <span
              className="z-[1] size-[22px] rounded-full"
              style={{ backgroundColor: s.circles[0] }}
            />
            <span
              className="-ml-2 size-[22px] rounded-full"
              style={{ backgroundColor: s.circles[1] }}
            />
          </span>
        </span>
      </span>
    </button>
  );
}

// Trivial label/value pair only meaningful inside the card (kept inline).
function CardField({
  label,
  value,
  s,
}: {
  label: string;
  value: string;
  s: CardStyle;
}) {
  return (
    <span className="flex flex-col">
      <span className={cn('text-[9px] uppercase tracking-wider', s.label)}>
        {label}
      </span>
      <span className={cn('text-[13px] font-medium', s.value)}>{value}</span>
    </span>
  );
}

export { BankPaymentCard, type BankPaymentCardProps, type CardVariant };
