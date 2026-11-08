import { Check } from 'lucide-react-native';

import { TwPressable } from '@finnit/ui-native/lib/tw';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Text } from '@finnit/ui-native/components/ui/text';

/** A single-choice option in a filter's sheet, checked when selected. */
export function ChoiceRow({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TwPressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      className="min-h-11 flex-row items-center justify-between gap-3 rounded-lg px-3 active:bg-accent"
    >
      <Text weight={selected ? 'medium' : undefined} className="text-sm">
        {label}
      </Text>
      {selected ? <Icon icon={Check} size={18} color="--brand-ink" /> : null}
    </TwPressable>
  );
}
