import { cn } from '../../lib/utils';
import { TwPressable, TwView } from '../../lib/tw';
import { Text } from './text';

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  className?: string;
  accessibilityLabel?: string;
}

/**
 * Pill tabs / toggle group (the web's Tabs and ToggleGroup for switching
 * views or periods).
 */
function Segmented<T extends string>({
  options,
  value,
  onValueChange,
  className,
  accessibilityLabel,
}: SegmentedProps<T>) {
  return (
    <TwView
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      className={cn('flex-row rounded-full bg-track p-1', className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <TwPressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onValueChange(option.value)}
            className={cn(
              'min-h-9 flex-1 items-center justify-center rounded-full px-3',
              selected && 'bg-surface shadow-sm',
            )}
          >
            <Text
              weight="medium"
              numberOfLines={1}
              className={cn('text-sm', selected ? 'text-on-background' : 'text-on-surface-variant')}
            >
              {option.label}
            </Text>
          </TwPressable>
        );
      })}
    </TwView>
  );
}

export { Segmented, type SegmentedOption, type SegmentedProps };
