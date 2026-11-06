import { useRouter, type Href } from 'expo-router';

import { TwPressable } from '@finnit/ui-native/lib/tw';
import { Text } from '@finnit/ui-native/components/ui/text';

/** The web's inline section links ("Ver calendario", "Ver todas"). */
export function TextLink({ href, label, onPress }: { href?: string; label: string; onPress?: () => void }) {
  const router = useRouter();
  return (
    <TwPressable
      accessibilityRole="link"
      onPress={onPress ?? (() => href && router.push(href as Href))}
      className="min-h-11 justify-center"
    >
      <Text weight="medium" className="text-sm text-income">
        {label}
      </Text>
    </TwPressable>
  );
}
