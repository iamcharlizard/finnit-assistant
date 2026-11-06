import { Check } from 'lucide-react-native';

import { cn } from '../../lib/utils';
import { TwPressable, TwView } from '../../lib/tw';
import { Icon } from './icon';
import { Text } from './text';

interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  /** Only for screen readers (e.g. a row's select box). */
  hideLabel?: boolean;
  className?: string;
}

/** A checkbox with its label; the whole row is the touch target. */
function Checkbox({ checked, onCheckedChange, label, disabled, hideLabel, className }: CheckboxProps) {
  return (
    <TwPressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => onCheckedChange(!checked)}
      className={cn('min-h-11 flex-row items-center gap-3', disabled && 'opacity-50', className)}
    >
      <TwView
        className={cn(
          'size-5 items-center justify-center rounded border-[1.5px]',
          checked ? 'border-accent-neon bg-accent-neon' : 'border-input',
        )}
      >
        {checked ? <Icon icon={Check} size={12} strokeWidth={3} color="--secondary-foreground" /> : null}
      </TwView>
      {hideLabel ? null : <Text className="text-sm text-on-surface-variant">{label}</Text>}
    </TwPressable>
  );
}

export { Checkbox, type CheckboxProps };
