import type { ViewProps } from 'react-native';

import { cn } from '../../lib/utils';
import { TwView } from '../../lib/tw';
import { useAppTheme } from '../../theme/theme-root';
import { Text } from '../ui/text';

type BoxProps = ViewProps & { className?: string };

function BalanceCardRoot({ className, style, ...props }: BoxProps) {
  const { scheme } = useAppTheme();
  return (
    <TwView
      className={cn('rounded-card border border-glass-border bg-glass p-6', className)}
      style={[
        { boxShadow: scheme === 'dark' ? '0 4px 24px rgba(0,0,0,0.4)' : '0 4px 24px rgba(0,0,0,0.06)' },
        style,
      ]}
      {...props}
    />
  );
}

interface BalanceCardHeaderProps {
  label?: string;
  amount: string;
  trend?: string;
  trendPositive?: boolean;
  /** "este mes" after the trend. */
  trendSuffix?: string;
  className?: string;
}

function BalanceCardHeader({
  label = 'Total balance',
  amount,
  trend,
  trendPositive = true,
  trendSuffix,
  className,
}: BalanceCardHeaderProps) {
  return (
    <TwView className={cn('mb-4', className)}>
      <Text weight="medium" className="mb-1 text-label-sm uppercase tracking-widest text-on-surface-variant">
        {label}
      </Text>
      <Text weight="bold" adjustsFontSizeToFit numberOfLines={1} className="text-display-lg text-on-background">
        {amount}
      </Text>
      {trend ? (
        <TwView className="mt-1 flex-row items-center gap-1">
          <Text weight="medium" className={cn('text-sm', trendPositive ? 'text-income' : 'text-expense')}>
            {trend}
          </Text>
          {trendSuffix ? <Text className="text-xs text-on-surface-variant">{trendSuffix}</Text> : null}
        </TwView>
      ) : null}
    </TwView>
  );
}

function BalanceCardFooter({ className, ...props }: BoxProps) {
  return <TwView className={cn('mt-4 flex-row items-center justify-between pt-4', className)} {...props} />;
}

/** Compound API like the web's: <BalanceCard.Root><BalanceCard.Header/>… */
export const BalanceCard = {
  Root: BalanceCardRoot,
  Header: BalanceCardHeader,
  Footer: BalanceCardFooter,
};
