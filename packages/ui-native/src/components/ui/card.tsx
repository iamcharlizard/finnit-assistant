import type { ViewProps } from 'react-native';

import { cn } from '../../lib/utils';
import { TwView } from '../../lib/tw';
import { useElevation } from '../../theme/theme-root';
import { Text, type TextProps } from './text';

type BoxProps = ViewProps & { className?: string };

/**
 * @finnit/ui's Card. The web blurs what's behind it; here the background
 * behind cards is the app's (smooth gradient at most), so the translucent
 * glass color alone looks the same without a costly blur per card.
 */
function Card({ className, style, ...props }: BoxProps) {
  const elevation = useElevation();
  return (
    <TwView
      className={cn('gap-4 rounded-card border border-glass-border bg-glass p-6', className)}
      style={[elevation, style]}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: BoxProps) {
  return (
    <TwView
      className={cn('flex-row items-start justify-between gap-3', className)}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: TextProps) {
  return (
    <Text
      accessibilityRole="header"
      weight="bold"
      className={cn('text-lg text-on-background', className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: TextProps) {
  return <Text className={cn('text-sm text-on-surface-variant', className)} {...props} />;
}

function CardContent({ className, ...props }: BoxProps) {
  return <TwView className={className} {...props} />;
}

function CardFooter({ className, ...props }: BoxProps) {
  return (
    <TwView
      className={cn('flex-row items-center justify-between', className)}
      {...props}
    />
  );
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
