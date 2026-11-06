import type * as React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
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
  children: React.ReactNode;
}

/**
 * A bottom sheet (the web's Sheet side="bottom" / small-screen dialogs):
 * slides up over a dim backdrop; a tap outside or the × closes it. Opaque
 * (`bg-popover`), also in Glass.
 */
function Sheet({ open, onOpenChange, title, description, closeLabel = 'Close', className, children }: SheetProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => onOpenChange(false)}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
        <Pressable
          style={[StyleSheet.absoluteFill, styles.backdrop]}
          accessibilityLabel={closeLabel}
          onPress={() => onOpenChange(false)}
        />
        <View style={styles.end} pointerEvents="box-none">
          <TwView
            accessibilityViewIsModal
            className="max-h-[90%] rounded-t-[28px] bg-popover"
            style={{ paddingBottom: Math.max(16, insets.bottom) }}
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
            <TwView className={cn('px-5 pt-2', className)}>{children}</TwView>
          </TwView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.4)' },
  end: { flex: 1, justifyContent: 'flex-end' },
});

export { Sheet, type SheetProps };
