// TODO: evaluar si mover a ui/ si resulta ser genérico

import { TwView, TwText, TwPressable } from '../../../lib/tw';
import { TwAnimatedView } from '../../../lib/tw/animated';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { FadeInUp } from 'react-native-reanimated';
import { useColorScheme } from 'nativewind';

type PaymentStatus = 'pending' | 'scheduled' | 'paid';

export interface PaymentItemProps {
  title: string;
  amount: string;
  status: PaymentStatus;
  timeLabel: string;
  symbolName: SymbolViewProps['name'];
  iconBg: string;
  iconTint?: string;
  onPress?: () => void;
  animationDelay?: number;
}

const STATUS_CONFIG = {
  pending: {
    label: 'PENDIENTE',
    lightBg: '#00696e',
    darkBg: '#00f5ff',
    textColor: '#ffffff' as string | null,
  },
  scheduled: {
    label: 'PROGRAMADO',
    lightBg: 'rgba(0,0,0,0.07)',
    darkBg: 'rgba(255,255,255,0.12)',
    textColor: null as string | null,
  },
  paid: {
    label: 'PAGADO',
    lightBg: 'rgba(34,197,94,0.15)',
    darkBg: 'rgba(34,197,94,0.2)',
    textColor: null as string | null,
  },
};

export function PaymentItem({
  title,
  amount,
  status,
  timeLabel,
  symbolName,
  iconBg,
  iconTint,
  onPress,
  animationDelay = 0,
}: PaymentItemProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const isPending = status === 'pending';
  const isPaid = status === 'paid';
  const config = STATUS_CONFIG[status];

  const containerBg = isPending
    ? isDark
      ? 'rgba(0,245,255,0.08)'
      : 'rgba(0,245,255,0.06)'
    : isPaid
    ? isDark
      ? 'rgba(255,255,255,0.02)'
      : 'rgba(0,0,0,0.01)'
    : isDark
    ? 'rgba(255,255,255,0.04)'
    : 'rgba(0,0,0,0.03)';

  const borderColor = isPending
    ? isDark
      ? 'rgba(0,245,255,0.25)'
      : 'rgba(0,245,255,0.3)'
    : isDark
    ? 'rgba(255,255,255,0.08)'
    : 'rgba(0,0,0,0.07)';

  const amountColor = isPending
    ? isDark
      ? '#00f5ff'
      : '#00696e'
    : isDark
    ? '#f8f9fa'
    : '#1a1b22';

  const statusBg = isDark ? config.darkBg : config.lightBg;
  const statusTextColor =
    config.textColor ??
    (status === 'paid'
      ? isDark
        ? '#4ade80'
        : '#166534'
      : isDark
      ? '#a0a0a0'
      : '#5c6370');

  return (
    <TwAnimatedView entering={FadeInUp.duration(300).delay(animationDelay)}>
      <TwPressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${amount}, ${config.label}`}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          padding: 12,
          borderRadius: 16,
          borderWidth: 1,
          borderColor,
          backgroundColor: containerBg,
          opacity: isPaid ? 0.65 : 1,
          minHeight: 44,
        }}
      >
        <TwView
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: iconBg,
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <SymbolView
            name={symbolName}
            size={22}
            tintColor={iconTint ?? '#ffffff'}
            accessibilityLabel=""
          />
        </TwView>

        <TwView style={{ flex: 1 }}>
          <TwText
            style={{ fontFamily: 'Ubuntu Bold', fontSize: 14, color: isDark ? '#f8f9fa' : '#1a1b22' }}
            numberOfLines={1}
          >
            {title}
          </TwText>
          <TwView style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <TwView
              style={{
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 99,
                backgroundColor: statusBg,
              }}
            >
              <TwText
                style={{
                  fontFamily: 'Ubuntu Bold',
                  fontSize: 8,
                  color: statusTextColor,
                  letterSpacing: 0.4,
                }}
              >
                {config.label}
              </TwText>
            </TwView>
            <TwText
              style={{
                fontFamily: 'Ubuntu',
                fontSize: 11,
                color: isDark ? '#a0a0a0' : '#5c6370',
              }}
            >
              {timeLabel}
            </TwText>
          </TwView>
        </TwView>

        <TwText
          style={{ fontFamily: 'Ubuntu Bold', fontSize: 14, color: amountColor }}
          accessibilityRole="text"
        >
          {amount}
        </TwText>
      </TwPressable>
    </TwAnimatedView>
  );
}
