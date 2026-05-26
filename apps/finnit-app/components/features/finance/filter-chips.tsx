// TODO: evaluar si mover a ui/ si resulta ser genérico

import { TwPressable, TwText, TwScrollView } from '@/lib/tw';
import { useColorScheme } from 'nativewind';

interface FilterItem {
  value: string;
  label: string;
}

interface FilterChipGroupProps {
  items: ReadonlyArray<FilterItem>;
  activeValue: string;
  onSelect: (value: string) => void;
  className?: string;
}

export function FilterChipGroup({
  items,
  activeValue,
  onSelect,
  className = '',
}: FilterChipGroupProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <TwScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="flex-row gap-2 pr-2"
      className={className}
      accessibilityRole="radiogroup"
    >
      {items.map((item) => {
        const isActive = item.value === activeValue;

        return (
          <TwPressable
            key={item.value}
            className={`px-5 rounded-full items-center justify-center active:opacity-70 ${
              isActive
                ? isDark
                  ? 'bg-primary-dark'
                  : 'bg-primary'
                : isDark
                  ? 'bg-surface-dark'
                  : 'bg-surface'
            }`}
            style={{
              minHeight: 44,
              paddingVertical: 10,
              borderWidth: isActive ? 0 : 1,
              borderColor: isActive
                ? 'transparent'
                : isDark
                  ? '#2d2e38'
                  : '#e0e0e0',
            }}
            onPress={() => onSelect(item.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: isActive }}
            accessibilityLabel={item.label}
          >
            <TwText
              className={`text-[14px] font-medium ${
                isActive
                  ? isDark
                    ? 'text-white'
                    : 'text-on-background'
                  : isDark
                    ? 'text-on-surface-variant-dark'
                    : 'text-on-surface-variant'
              }`}
              style={{ fontFamily: 'Ubuntu Medium' }}
            >
              {item.label}
            </TwText>
          </TwPressable>
        );
      })}
    </TwScrollView>
  );
}
