import { cn } from '../../lib/utils';
import { TwPressable, TwView } from '../../lib/tw';
import { Text } from './text';

interface ToggleGroupOption<T extends string> {
  value: T;
  label: string;
}

interface ToggleGroupProps<T extends string> {
  options: ToggleGroupOption<T>[];
  /** null = none picked. */
  value: T | null;
  onValueChange: (value: T) => void;
  className?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
}

/**
 * @finnit/ui's ToggleGroup (single): outlined pills that wrap to more
 * lines, the picked one filled. For choices with more options than fit a
 * Segmented (loan types, months).
 */
function ToggleGroup<T extends string>({
  options,
  value,
  onValueChange,
  className,
  accessibilityLabel,
  disabled,
}: ToggleGroupProps<T>) {
  return (
    <TwView
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      className={cn('flex-row flex-wrap gap-2', className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <TwPressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => onValueChange(option.value)}
            className={cn(
              'min-h-11 items-center justify-center rounded-full border px-4',
              selected
                ? 'border-transparent bg-primary'
                : 'border-outline bg-surface active:bg-accent',
              disabled && 'opacity-50',
            )}
          >
            <Text
              weight="medium"
              numberOfLines={1}
              className={cn(
                'text-sm',
                selected
                  ? 'text-primary-foreground'
                  : 'text-on-surface-variant',
              )}
            >
              {option.label}
            </Text>
          </TwPressable>
        );
      })}
    </TwView>
  );
}

export { ToggleGroup, type ToggleGroupOption, type ToggleGroupProps };
