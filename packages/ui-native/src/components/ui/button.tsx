import type * as React from 'react';
import type { LucideIcon } from 'lucide-react-native';

import { cn } from '../../lib/utils';
import { TwPressable, type TwPressableProps } from '../../lib/tw';
import { Icon } from './icon';
import { Text } from './text';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'destructive' | 'link';
type ButtonSize = 'default' | 'sm' | 'lg' | 'icon' | 'icon-sm' | 'icon-xs';

const CONTAINER: Record<ButtonVariant, string> = {
  primary: 'bg-primary',
  secondary: 'bg-accent-neon',
  ghost: '',
  outline: 'border border-outline',
  destructive: 'border border-expense-30 bg-expense-10',
  link: 'min-h-0',
};

/** Label class and icon token per variant (RN text doesn't inherit color). */
const FOREGROUND: Record<ButtonVariant, { text: string; token: `--${string}` }> = {
  primary: { text: 'text-primary-foreground', token: '--primary-foreground' },
  secondary: { text: 'text-secondary-foreground', token: '--secondary-foreground' },
  ghost: { text: 'text-brand-ink', token: '--brand-ink' },
  outline: { text: 'text-on-background', token: '--on-background' },
  destructive: { text: 'text-expense', token: '--expense' },
  link: { text: 'text-brand-ink underline', token: '--brand-ink' },
};

const SIZE: Record<ButtonSize, { box: string; text: string; icon: number }> = {
  default: { box: 'min-h-11 px-6 py-3', text: 'text-sm', icon: 16 },
  sm: { box: 'min-h-9 px-4 py-2', text: 'text-xs', icon: 14 },
  lg: { box: 'min-h-14 px-8', text: 'text-base', icon: 18 },
  icon: { box: 'size-11 rounded-full p-0', text: 'text-sm', icon: 20 },
  'icon-sm': { box: 'size-9 rounded-full p-0', text: 'text-sm', icon: 18 },
  'icon-xs': { box: 'size-8 rounded-full p-0', text: 'text-sm', icon: 16 },
};

interface ButtonProps extends Omit<TwPressableProps, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** The text; required for icon-only sizes too (used as accessibility label). */
  label: string;
  /** Leading icon (the only content for icon sizes). */
  icon?: LucideIcon;
  /** Trailing content, e.g. an arrow icon. */
  trailing?: React.ReactNode;
}

/** @finnit/ui's Button for React Native: same variants and sizes, onPress for onClick. */
function Button({
  variant = 'primary',
  size = 'default',
  label,
  icon,
  trailing,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const iconOnly = size.startsWith('icon');
  const fg = FOREGROUND[variant];
  return (
    <TwPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      className={cn(
        'flex-row items-center justify-center gap-2 rounded-button active:opacity-75',
        CONTAINER[variant],
        SIZE[size].box,
        disabled && 'opacity-50',
        className,
      )}
      {...props}
    >
      {icon ? <Icon icon={icon} size={SIZE[size].icon} color={fg.token} /> : null}
      {iconOnly ? null : (
        <Text weight="medium" className={cn(SIZE[size].text, fg.text)} numberOfLines={1}>
          {label}
        </Text>
      )}
      {trailing}
    </TwPressable>
  );
}

export { Button, type ButtonProps, type ButtonSize, type ButtonVariant };
