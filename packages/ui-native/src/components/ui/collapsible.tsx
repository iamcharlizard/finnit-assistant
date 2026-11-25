import * as React from 'react';
import {
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const EASE = Easing.bezier(0.32, 0.72, 0, 1);
const MEASURED: ViewStyle = { position: 'absolute', top: 0, left: 0, right: 0 };
const DURATION_MS = 280;

interface CollapsibleProps {
  open: boolean;
  children: React.ReactNode;
  /** The content's own layout (e.g. `{ gap: 12 }`). */
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * Content that folds: its height goes to 0 (clipped, never overlapping
 * what's below, which moves up with its bottom edge) and back to its own
 * height, measured on the content laid out at full size. It stays
 * mounted, so it opens without loading again; while closed it is hidden
 * from touch and screen readers. With "Reduce motion" it just shows or
 * hides.
 */
function Collapsible({ open, children, contentStyle }: CollapsibleProps) {
  const reduceMotion = useReducedMotion();
  // The content's natural height; -1 until the first layout.
  const height = useSharedValue(-1);
  // Starts where it is (no animation when the screen mounts); animates
  // only when `open` changes.
  const progress = useSharedValue(open ? 1 : 0);
  React.useEffect(() => {
    progress.value = reduceMotion
      ? open
        ? 1
        : 0
      : withTiming(open ? 1 : 0, { duration: DURATION_MS, easing: EASE });
  }, [open, reduceMotion, progress]);

  const style = useAnimatedStyle(() => {
    // Not measured yet: nothing shows (the next frame has the height).
    if (height.value < 0) return { height: 0, opacity: 0 };
    return {
      height: height.value * progress.value,
      // Fades a little only in the last part of closing.
      opacity: Math.min(1, progress.value * 2),
    };
  });

  const onLayout = React.useCallback(
    (event: LayoutChangeEvent) => {
      height.value = event.nativeEvent.layout.height;
    },
    [height],
  );

  return (
    <Animated.View
      style={[{ overflow: 'hidden' }, style]}
      pointerEvents={open ? 'auto' : 'none'}
      accessibilityElementsHidden={!open}
      importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
    >
      {/* Absolute: its height is always the content's. In the flow, Yoga
          shrank it with the closing box, so it measured 0 and never
          opened again. */}
      <Animated.View onLayout={onLayout} style={[MEASURED, contentStyle]}>
        {children}
      </Animated.View>
    </Animated.View>
  );
}

export { Collapsible, type CollapsibleProps };
