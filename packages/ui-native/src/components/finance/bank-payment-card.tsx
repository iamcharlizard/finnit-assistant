import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Cpu, CreditCard, EyeOff, Nfc, type LucideIcon } from 'lucide-react-native';

import { LIGHT_TEXT, isHexColor, normalizeHex, readableTextColor } from '@finnit/core/format/color';
import type { CardVariant } from '@finnit/core/ui/bank-card';

import { TwPressable, TwView } from '../../lib/tw';
import { useAppTheme } from '../../theme/theme-root';
import { Text } from '../ui/text';

/** Colors of one preset look, per scheme: [light, dark]. */
interface Look {
  /** Gradient stops (135°), or one color. */
  surface: [string, string][];
  border: [string, string];
  shadow: string;
  tier: [string, string];
  name: [string, string];
  number: [string, string];
  label: [string, string];
  value: [string, string];
  circles: [string, string];
  icon: LucideIcon;
  iconColor: [string, string];
}

/* The web's CARD_STYLES (packages/ui bank-payment-card), as plain colors. */
const LOOKS: Record<CardVariant, Look> = {
  platinum: {
    surface: [
      ['rgba(255,255,255,0.45)', 'rgba(255,255,255,0.18)'],
      ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.04)'],
    ],
    border: ['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.2)'],
    shadow: '0 10px 32px rgba(0,0,0,0.10)',
    tier: ['rgba(0,105,110,0.85)', 'rgba(0,245,255,0.8)'],
    name: ['#004f53', '#ffffff'],
    number: ['#191c1d', '#ffffff'],
    label: ['rgba(58,73,74,0.7)', 'rgba(255,255,255,0.5)'],
    value: ['#191c1d', '#ffffff'],
    circles: ['rgba(0,245,255,0.5)', 'rgba(108,114,203,0.45)'],
    icon: CreditCard,
    iconColor: ['rgba(0,105,110,0.5)', 'rgba(255,255,255,0.4)'],
  },
  virtual: {
    surface: [
      ['rgba(149,0,202,0.22)', 'rgba(149,0,202,0.22)'],
      ['rgba(149,0,202,0.08)', 'rgba(149,0,202,0.08)'],
    ],
    border: ['rgba(149,0,202,0.4)', 'rgba(149,0,202,0.4)'],
    shadow: '0 10px 32px rgba(149,0,202,0.18)',
    tier: ['rgba(50,0,71,0.85)', '#e9b3ff'],
    name: ['#9500ca', '#e9b3ff'],
    number: ['#320047', '#ffffff'],
    label: ['rgba(50,0,71,0.6)', 'rgba(255,255,255,0.5)'],
    value: ['#320047', '#ffffff'],
    circles: ['rgba(149,0,202,0.5)', 'rgba(173,0,155,0.35)'],
    icon: EyeOff,
    iconColor: ['rgba(149,0,202,0.5)', 'rgba(233,179,255,0.5)'],
  },
  premium: {
    surface: [
      ['rgba(108,114,203,0.38)', 'rgba(108,114,203,0.38)'],
      ['rgba(255,171,242,0.14)', 'rgba(255,171,242,0.14)'],
    ],
    border: ['rgba(191,194,255,0.22)', 'rgba(191,194,255,0.22)'],
    shadow: '0 8px 28px rgba(108,114,203,0.28)',
    tier: ['--violet-ink', '--violet-ink'],
    name: ['--on-background', '--on-background'],
    number: ['--on-background', '--on-background'],
    label: ['--on-surface-variant', '--on-surface-variant'],
    value: ['--on-background', '--on-background'],
    circles: ['rgba(108,114,203,0.6)', 'rgba(255,171,242,0.5)'],
    icon: Nfc,
    iconColor: ['--highlight', '--highlight'],
  },
  stealth: {
    surface: [
      ['#252730', '#252730'],
      ['#252730', '#252730'],
    ],
    border: ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.05)'],
    shadow: '0 4px 18px rgba(0,0,0,0.45)',
    tier: ['rgba(199,197,211,0.75)', 'rgba(199,197,211,0.75)'],
    name: ['rgba(227,225,235,0.8)', 'rgba(227,225,235,0.8)'],
    number: ['rgba(227,225,235,0.65)', 'rgba(227,225,235,0.65)'],
    label: ['rgba(199,197,211,0.75)', 'rgba(199,197,211,0.75)'],
    value: ['rgba(199,197,211,0.9)', 'rgba(199,197,211,0.9)'],
    circles: ['rgba(199,197,211,0.35)', 'rgba(199,197,211,0.2)'],
    icon: Cpu,
    iconColor: ['rgba(199,197,211,0.55)', 'rgba(199,197,211,0.55)'],
  },
};

interface BankPaymentCardProps {
  variant: CardVariant;
  /** Custom color ('#RRGGBB'); with `secondaryColor`, a 135° gradient. */
  primaryColor?: string;
  secondaryColor?: string;
  holderLabel?: string;
  expiryLabel?: string;
  balanceLabel?: string;
  cardTier: string;
  bankName?: string;
  maskedNumber: string;
  holderName?: string;
  expiryDate?: string;
  balance?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
  /** Extra shadow (e.g. the active card in a stack). */
  shadow?: string;
  dimmed?: boolean;
}

export const BANK_CARD_HEIGHT = 210;

/** An account drawn as a card (@finnit/ui's BankPaymentCard). */
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
  onPress,
  accessibilityLabel,
  shadow,
  dimmed,
}: BankPaymentCardProps) {
  const { scheme, tokens } = useAppTheme();
  const id = React.useId().replace(/:/g, '');
  const [width, setWidth] = React.useState(0);
  const dark = scheme === 'dark' ? 1 : 0;
  const pick = (pair: [string, string]) => {
    const value = pair[dark]!;
    return value.startsWith('--') ? (tokens[value as `--${string}`] ?? value) : value;
  };

  const primary = primaryColor && isHexColor(primaryColor) ? normalizeHex(primaryColor) : undefined;
  const secondary = primary && secondaryColor && isHexColor(secondaryColor) ? normalizeHex(secondaryColor) : undefined;
  const custom = primary ? readableTextColor(secondary ? [primary, secondary] : primary) : undefined;
  const look = LOOKS[variant];
  const lightText = custom === LIGHT_TEXT;

  const stops: [string, string] = primary
    ? [primary, secondary ?? primary]
    : [pick(look.surface[0]!), pick(look.surface[1]!)];
  const text = (pair: [string, string]) => custom ?? pick(pair);
  const circles: [string, string] = custom
    ? lightText
      ? ['rgba(255,255,255,0.45)', 'rgba(255,255,255,0.25)']
      : ['rgba(11,12,26,0.35)', 'rgba(11,12,26,0.2)']
    : look.circles;
  const border = custom ? (lightText ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)') : pick(look.border);
  const Glyph = look.icon;

  const field = (label: string, value: string) => (
    <TwView>
      <Text className="text-[9px] uppercase tracking-wider" style={{ color: text(look.label) }}>
        {label}
      </Text>
      <Text weight="medium" className="text-[13px]" style={{ color: text(look.value) }}>
        {value}
      </Text>
    </TwView>
  );

  return (
    <TwPressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel ?? [bankName, cardTier, maskedNumber, balance].filter(Boolean).join(', ')}
      onPress={onPress}
      disabled={!onPress}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      className="w-full justify-between overflow-hidden rounded-[28px] border p-[22px] active:opacity-90"
      style={{
        height: BANK_CARD_HEIGHT,
        borderColor: border,
        boxShadow: shadow ?? (custom ? (lightText ? '0 10px 32px rgba(0,0,0,0.25)' : '0 10px 32px rgba(0,0,0,0.12)') : look.shadow),
        opacity: dimmed ? 0.7 : 1,
      }}
    >
      {width > 0 ? (
        <Svg style={StyleSheet.absoluteFill} width={width} height={BANK_CARD_HEIGHT} pointerEvents="none">
          <Defs>
            <LinearGradient id={`card-${id}`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={stops[0]} />
              <Stop offset="1" stopColor={stops[1]} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={width} height={BANK_CARD_HEIGHT} fill={`url(#card-${id})`} />
        </Svg>
      ) : null}
      <View pointerEvents="none" style={[styles.glow]} />
      <TwView className="flex-row items-start justify-between">
        <TwView className="gap-0.5">
          <Text weight="medium" className="text-[10px] uppercase tracking-[0.25em]" style={{ color: text(look.tier) }}>
            {cardTier}
          </Text>
          {bankName ? (
            <Text weight="bold" numberOfLines={1} className="text-[19px]" style={{ color: text(look.name) }}>
              {bankName}
            </Text>
          ) : null}
        </TwView>
        <Glyph size={28} color={custom ?? pick(look.iconColor)} opacity={custom ? 0.7 : 1} />
      </TwView>
      <TwView className="gap-2.5">
        <Text className="text-[19px] tracking-[0.18em]" style={{ color: text(look.number) }}>
          {maskedNumber}
        </Text>
        <TwView className="flex-row items-end justify-between">
          {balance ? (
            field(balanceLabel, balance)
          ) : (
            <TwView className="flex-row gap-5">
              {holderName ? field(holderLabel, holderName) : null}
              {expiryDate ? field(expiryLabel, expiryDate) : null}
            </TwView>
          )}
          <TwView className="flex-row items-center">
            <TwView className="z-[1] size-[22px] rounded-full" style={{ backgroundColor: circles[0] }} />
            <TwView className="-ml-2 size-[22px] rounded-full" style={{ backgroundColor: circles[1] }} />
          </TwView>
        </TwView>
      </TwView>
    </TwPressable>
  );
}

const styles = StyleSheet.create({
  glow: {
    position: 'absolute',
    top: -80,
    right: -64,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
});

export { BankPaymentCard, type BankPaymentCardProps };
