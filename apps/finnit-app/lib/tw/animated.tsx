import { useCssElement } from 'react-native-css';
import Animated, { type AnimatedProps } from 'react-native-reanimated';
import type { ViewProps } from 'react-native';

const mapping = { className: 'style' } as const;

// Reanimated's Animated.View carries deeply nested generic types that exceed
// TypeScript's instantiation depth limit when passed to useCssElement.
// Widening to ComponentType<Record<string, unknown>> prevents TS2589 while
// preserving correct runtime behavior (props are forwarded via spread).
const AnimatedViewBase = Animated.View as React.ComponentType<Record<string, unknown>>;

export function TwAnimatedView(
  props: AnimatedProps<ViewProps> & { className?: string },
): React.ReactElement {
  return useCssElement(AnimatedViewBase, props as Record<string, unknown>, mapping) as React.ReactElement;
}
