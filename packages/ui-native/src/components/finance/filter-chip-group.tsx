import { ScrollView } from 'react-native';

import { cn } from '../../lib/utils';
import { TwPressable } from '../../lib/tw';
import { Text } from '../ui/text';

interface FilterChipGroupProps<T extends string> {
  items: { value: T; label: string }[];
  activeValue: T;
  onSelect: (value: T) => void;
  accessibilityLabel?: string;
  className?: string;
}

/** Filter chips in a row that scrolls sideways (@finnit/ui's FilterChipGroup). */
function FilterChipGroup<T extends string>({
  items,
  activeValue,
  onSelect,
  accessibilityLabel,
  className,
}: FilterChipGroupProps<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      contentContainerStyle={{ gap: 8 }}
      className={className}
    >
      {items.map((item) => {
        const active = item.value === activeValue;
        return (
          <TwPressable
            key={item.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            onPress={() => onSelect(item.value)}
            className={cn(
              'min-h-11 justify-center rounded-full border px-5',
              active ? 'border-transparent bg-primary' : 'border-outline bg-surface',
            )}
          >
            <Text weight="medium" className={cn('text-sm', active ? 'text-primary-foreground' : 'text-on-surface-variant')}>
              {item.label}
            </Text>
          </TwPressable>
        );
      })}
    </ScrollView>
  );
}

export { FilterChipGroup, type FilterChipGroupProps };
