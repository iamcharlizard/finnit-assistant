import { Plus } from 'lucide-react-native';

import { Text } from '@finnit/ui-native/components/ui/text';
import { useToken } from '@finnit/ui-native/theme/theme-root';
import { TwPressable, TwView } from '@finnit/ui-native/lib/tw';

/**
 * "Agregar cuenta" under the card stack: a dashed card of the same width
 * and corners, where the next account would go.
 */
export function AddAccountTile({ label, onPress }: { label: string; onPress: () => void }) {
  const primary = useToken('--primary');
  return (
    <TwPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="w-full flex-row items-center justify-center gap-3 self-center rounded-[28px] border-2 border-dashed border-outline px-6 py-6 active:opacity-70"
      style={{ maxWidth: 360 }}
    >
      <TwView className="size-9 items-center justify-center rounded-full bg-primary-10">
        <Plus size={20} color={primary} />
      </TwView>
      <Text weight="medium" className="text-base text-on-background">
        {label}
      </Text>
    </TwPressable>
  );
}
