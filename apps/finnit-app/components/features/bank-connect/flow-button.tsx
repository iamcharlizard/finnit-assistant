import { TwPressable, TwText } from '@/lib/tw';
import { useBankConnectPalette } from '@/hooks/use-bank-connect-palette';

type FlowButtonVariant = 'primary' | 'secondary' | 'ghost';

interface FlowButtonProps {
  label: string;
  onPress: () => void;
  variant?: FlowButtonVariant;
  disabled?: boolean;
  accessibilityHint?: string;
}

/** Full-width action button of the bank connection steps (light/dark aware). */
export function FlowButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  accessibilityHint,
}: FlowButtonProps) {
  const P = useBankConnectPalette();

  const container =
    variant === 'primary'
      ? { backgroundColor: P.primary }
      : variant === 'secondary'
        ? { borderWidth: 1, borderColor: `${P.primary}66`, backgroundColor: `${P.primary}14` }
        : {};
  const textColor = variant === 'primary' ? P.onPrimary : variant === 'secondary' ? P.primary : P.onSurfaceVariant;

  return (
    <TwPressable
      className="rounded-full px-6 items-center justify-center active:opacity-75"
      style={{ ...container, minHeight: 48, opacity: disabled ? 0.5 : 1 }}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
    >
      <TwText style={{ fontFamily: 'Ubuntu Medium', fontSize: 15, color: textColor }}>{label}</TwText>
    </TwPressable>
  );
}
