/**
 * React Native primitives that take `className` (NativeWind v5 without the
 * global className polyfill).
 *
 * View, Text and TextInput come typed from react-native-css. Pressable,
 * ScrollView and Animated.View go through useCssElement; their prop unions
 * exceed TypeScript's instantiation limits as generic arguments (TS2589 /
 * TS2590), so they are widened to ComponentType<Record<string, unknown>>
 * first. Runtime behavior is unchanged.
 */
import type * as React from 'react';
import {
  Pressable,
  ScrollView,
  type PressableProps,
  type ScrollViewProps,
  type ViewProps,
} from 'react-native';
import { useCssElement } from 'react-native-css';
import Animated, { type AnimatedProps } from 'react-native-reanimated';

export {
  View as TwView,
  Text as TwText,
  TextInput as TwTextInput,
} from 'react-native-css/components';

type AnyComponent = React.ComponentType<Record<string, unknown>>;

const PressableBase = Pressable as AnyComponent;
const ScrollViewBase = ScrollView as AnyComponent;
const AnimatedViewBase = Animated.View as AnyComponent;

const viewMapping = { className: 'style' } as const;
const scrollMapping = {
  className: 'style',
  contentContainerClassName: 'contentContainerStyle',
} as const;

export type TwPressableProps = PressableProps & { className?: string };

export function TwPressable(props: TwPressableProps): React.ReactElement {
  return useCssElement(
    PressableBase,
    props as Record<string, unknown>,
    viewMapping,
  ) as React.ReactElement;
}

export function TwScrollView(
  props: ScrollViewProps & {
    className?: string;
    contentContainerClassName?: string;
  },
): React.ReactElement {
  return useCssElement(
    ScrollViewBase,
    props as Record<string, unknown>,
    scrollMapping,
  ) as React.ReactElement;
}

export function TwAnimatedView(
  props: AnimatedProps<ViewProps> & { className?: string },
): React.ReactElement {
  return useCssElement(
    AnimatedViewBase,
    props as Record<string, unknown>,
    viewMapping,
  ) as React.ReactElement;
}
