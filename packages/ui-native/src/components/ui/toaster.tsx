import * as React from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleAlert, CircleCheck } from 'lucide-react-native';

import { cn } from '../../lib/utils';
import { TwView } from '../../lib/tw';
import { useElevation } from '../../theme/theme-root';
import { Icon } from './icon';
import { Text } from './text';

type ToastKind = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

const listeners = new Set<(items: ToastItem[]) => void>();
let items: ToastItem[] = [];
let nextId = 1;

function emit() {
  listeners.forEach((listener) => listener(items));
}

function show(kind: ToastKind, message: string, duration = 3500) {
  const item = { id: nextId++, kind, message };
  items = [...items.slice(-2), item];
  emit();
  AccessibilityInfo.announceForAccessibility(message);
  setTimeout(() => {
    items = items.filter((i) => i.id !== item.id);
    emit();
  }, duration);
}

/** Short confirmations and errors, like the web's `toast` (sonner). */
export const toast = {
  success: (message: string) => show('success', message),
  error: (message: string) => show('error', message, 5000),
  info: (message: string) => show('info', message),
};

/** Where toasts appear (top of the screen); render it once at the root. */
export function Toaster() {
  const [current, setCurrent] = React.useState<ToastItem[]>(items);
  const insets = useSafeAreaInsets();
  const elevation = useElevation();
  React.useEffect(() => {
    listeners.add(setCurrent);
    return () => {
      listeners.delete(setCurrent);
    };
  }, []);
  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { paddingTop: insets.top + 8 }]}>
      {current.map((item) => (
        <Animated.View key={item.id} entering={FadeInUp} exiting={FadeOutUp} style={styles.item}>
          <TwView
            accessibilityRole="alert"
            className="flex-row items-center gap-3 rounded-2xl border border-outline bg-popover px-4 py-3"
            style={elevation}
          >
            <Icon
              icon={item.kind === 'error' ? CircleAlert : CircleCheck}
              size={18}
              color={item.kind === 'error' ? '--expense' : item.kind === 'success' ? '--income' : '--on-surface-variant'}
            />
            <Text className={cn('flex-1 text-sm', item.kind === 'error' ? 'text-expense' : 'text-popover-foreground')}>
              {item.message}
            </Text>
          </TwView>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  item: { marginHorizontal: 16, marginBottom: 8 },
});
