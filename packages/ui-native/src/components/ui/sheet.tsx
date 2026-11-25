import * as React from 'react';
import {
  Keyboard,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type KeyboardEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

import { cn } from '../../lib/utils';
import { TwPressable, TwView } from '../../lib/tw';
import { Icon } from './icon';
import { Text } from './text';

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  closeLabel?: string;
  /** Content area classes (padding is already there). */
  className?: string;
  /**
   * Pinned under the content (e.g. the save button): with the keyboard up
   * it sits right above it, while the content scrolls.
   */
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/** The keyboard's height while it shows (0 when hidden), animated like it on iOS. */
function useKeyboardHeight(): number {
  const [height, setHeight] = React.useState(0);
  React.useEffect(() => {
    const ios = Platform.OS === 'ios';
    const follow = (next: number) => (event: KeyboardEvent) => {
      if (ios && event.duration) {
        LayoutAnimation.configureNext({
          duration: event.duration,
          update: { type: LayoutAnimation.Types.keyboard },
        });
      }
      setHeight(next || 0);
    };
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (event) =>
      follow(event.endCoordinates.height)(event),
    );
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', (event) => follow(0)(event));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}

/**
 * A bottom sheet (the web's Sheet side="bottom" / small-screen dialogs):
 * slides up over a dim backdrop; a tap outside or the × closes it. Opaque
 * (`bg-popover`), also in Glass. With the keyboard up the sheet reaches
 * under it (no backdrop showing there), the `footer` sits right above it
 * and the content shrinks (give a scrolling content `flexShrink: 1`).
 */
function Sheet({ open, onOpenChange, title, description, closeLabel = 'Close', className, footer, children }: SheetProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const keyboard = useKeyboardHeight();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => onOpenChange(false)}>
      <View style={styles.fill}>
        <Pressable
          style={[StyleSheet.absoluteFill, styles.backdrop]}
          accessibilityLabel={closeLabel}
          onPress={() => onOpenChange(false)}
        />
        <View style={styles.end} pointerEvents="box-none">
          <TwView
            accessibilityViewIsModal
            className="rounded-t-[28px] bg-popover"
            style={{
              maxHeight: windowHeight * 0.9,
              // The keyboard covers this part, so the sheet's color (not the
              // backdrop) shows behind it.
              paddingBottom: keyboard > 0 ? keyboard + 12 : Math.max(16, insets.bottom),
            }}
          >
            <TwView className="items-center pt-2">
              <TwView className="h-1 w-10 rounded-full bg-outline" />
            </TwView>
            {title ? (
              <TwView className="flex-row items-start gap-3 px-5 pb-2 pt-3">
                <TwView className="min-w-0 flex-1">
                  <Text accessibilityRole="header" weight="bold" className="text-lg text-popover-foreground">
                    {title}
                  </Text>
                  {description ? <Text className="text-sm text-on-surface-variant">{description}</Text> : null}
                </TwView>
                <TwPressable
                  accessibilityRole="button"
                  accessibilityLabel={closeLabel}
                  onPress={() => onOpenChange(false)}
                  className="-mr-2 -mt-1 size-11 items-center justify-center rounded-full active:bg-accent"
                >
                  <Icon icon={X} size={20} color="--on-surface-variant" />
                </TwPressable>
              </TwView>
            ) : null}
            <TwView className={cn('px-5 pt-2', className)} style={styles.shrink}>
              {children}
            </TwView>
            {footer ? <TwView className="px-5 pt-3">{footer}</TwView> : null}
          </TwView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.4)' },
  end: { flex: 1, justifyContent: 'flex-end' },
  shrink: { flexShrink: 1 },
});

export { Sheet, type SheetProps };
