import { TwPressable, TwText } from '../../lib/tw';
import type { PressableProps } from 'react-native';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline';

interface ButtonProps extends PressableProps {
  label: string;
  variant?: ButtonVariant;
  className?: string;
  accessibilityLabel?: string;
}

const variantClasses: Record<ButtonVariant, { container: string; text: string }> = {
  primary: {
    container: 'bg-primary rounded-full px-6 py-3 items-center justify-center',
    text: 'text-on-background font-medium text-[14px]',
  },
  secondary: {
    container: 'bg-accent-neon rounded-full px-6 py-3 items-center justify-center',
    text: 'text-white font-medium text-[14px]',
  },
  ghost: {
    container: 'rounded-full px-6 py-3 items-center justify-center',
    text: 'text-primary font-medium text-[14px]',
  },
  outline: {
    container: 'border border-outline rounded-full px-6 py-3 items-center justify-center',
    text: 'text-on-background font-medium text-[14px]',
  },
};

export function Button({
  label,
  variant = 'primary',
  className = '',
  accessibilityLabel,
  ...props
}: ButtonProps) {
  const styles = variantClasses[variant];

  return (
    <TwPressable
      className={`${styles.container} active:opacity-75 ${className}`}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={{ minHeight: 44 }}
      {...props}
    >
      <TwText
        className={styles.text}
        style={{ fontFamily: 'Ubuntu Medium' }}
      >
        {label}
      </TwText>
    </TwPressable>
  );
}
