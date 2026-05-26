// TODO: evaluar si mover a ui/ si resulta ser genérico

import { TwView, TwText, TwPressable } from '../../../lib/tw';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useColorScheme } from 'nativewind';

type SymbolName = SymbolViewProps['name'];

export type StatusVariant = 'completado' | 'info' | 'pendiente' | 'fallida';
export type ItemVariant = 'income' | 'expense' | 'pending' | 'failed';

export interface TransactionItemWithStatusProps {
  merchant: string;
  category: string;
  time: string;
  amount: string;
  statusLabel: string;
  statusVariant: StatusVariant;
  itemVariant: ItemVariant;
  symbolName: SymbolName;
  onPress?: () => void;
}

function iconBgForVariant(variant: ItemVariant, isDark: boolean): string {
  if (variant === 'income') return isDark ? 'rgba(0,102,136,0.2)' : 'rgba(0,102,136,0.1)';
  if (variant === 'pending') return isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
  return isDark ? 'rgba(186,26,26,0.15)' : 'rgba(186,26,26,0.08)';
}

function amountColorForVariant(variant: ItemVariant, isDark: boolean): string {
  if (variant === 'income') return '#006688';
  if (variant === 'pending') return isDark ? '#a0a0a0' : '#5c6370';
  return '#ba1a1a';
}

function statusColorForStatus(status: StatusVariant, isDark: boolean): string {
  if (status === 'completado') return isDark ? '#00f5ff' : '#006688';
  if (status === 'fallida') return '#ba1a1a';
  return isDark ? '#a0a0a0' : '#5c6370';
}

export function TransactionItemWithStatus({
  merchant,
  category,
  time,
  amount,
  statusLabel,
  statusVariant,
  itemVariant,
  symbolName,
  onPress,
}: TransactionItemWithStatusProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <TwPressable
      className={`flex-row items-center justify-between p-4 rounded-[16px] ${
        isDark ? 'bg-surface-dark' : 'bg-surface'
      }`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${merchant}, ${amount}, ${statusLabel}`}
      style={{ minHeight: 44 }}
    >
      <TwView className="flex-row items-center gap-4 flex-1">
        <TwView
          className="w-12 h-12 rounded-[12px] items-center justify-center"
          style={{ backgroundColor: iconBgForVariant(itemVariant, isDark) }}
        >
          <SymbolView
            name={symbolName}
            size={22}
            tintColor={isDark ? '#a0a0a0' : '#5c6370'}
            accessibilityLabel=""
          />
        </TwView>

        <TwView className="flex-1">
          <TwText
            className={`text-[14px] font-medium ${
              isDark ? 'text-on-background-dark' : 'text-on-background'
            }`}
            style={{ fontFamily: 'Ubuntu Medium' }}
          >
            {merchant}
          </TwText>
          <TwText
            className={`text-[12px] mt-0.5 ${
              isDark ? 'text-on-surface-variant-dark' : 'text-on-surface-variant'
            }`}
            style={{ fontFamily: 'Ubuntu' }}
          >
            {category} · {time}
          </TwText>
        </TwView>
      </TwView>

      <TwView className="items-end ml-2">
        <TwText
          className="text-[14px] font-bold"
          style={{
            fontFamily: 'Ubuntu Bold',
            color: amountColorForVariant(itemVariant, isDark),
          }}
          accessibilityRole="text"
        >
          {amount}
        </TwText>
        <TwText
          className="text-[11px] mt-0.5"
          style={{
            fontFamily: 'Ubuntu',
            color: statusColorForStatus(statusVariant, isDark),
          }}
        >
          {statusLabel}
        </TwText>
      </TwView>
    </TwPressable>
  );
}
