/**
 * CSS-aware React Native component wrappers for NativeWind v5.
 *
 * - View, Text, TextInput: use react-native-css pre-built components (full type safety).
 * - Pressable, ScrollView, TouchableHighlight: useCssElement triggers TS2590 ("union
 *   type too complex") because their animated-style prop unions exceed TypeScript's
 *   instantiation limit when used as generic param C in useCssElement<C, M>.
 *   Fix: widen the component to ComponentType<Record<string,unknown>> before passing it;
 *   this prevents the deep generic instantiation while keeping correct runtime behavior.
 */

export {
  View as TwView,
  Text as TwText,
  TextInput as TwTextInput,
} from 'react-native-css/components';

import { useCssElement } from 'react-native-css';
import {
  Pressable,
  ScrollView,
  TouchableHighlight,
  type PressableProps,
  type ScrollViewProps,
  type TouchableHighlightProps,
} from 'react-native';
import { Link, type LinkProps } from 'expo-router';

type AnyComponent = React.ComponentType<Record<string, unknown>>;

const PressableBase = Pressable as AnyComponent;
const ScrollViewBase = ScrollView as AnyComponent;
const TouchableHighlightBase = TouchableHighlight as AnyComponent;
// Link has static properties (resolveHref, Menu…) that prevent a direct cast;
// double-widening through unknown is required to bypass that structural check.
const LinkBase = Link as unknown as AnyComponent;

const viewMapping = { className: 'style' } as const;
const scrollMapping = {
  className: 'style',
  contentContainerClassName: 'contentContainerStyle',
} as const;

export function TwPressable(props: PressableProps & { className?: string }): React.ReactElement {
  return useCssElement(PressableBase, props as Record<string, unknown>, viewMapping) as React.ReactElement;
}

export function TwScrollView(
  props: ScrollViewProps & {
    className?: string;
    contentContainerClassName?: string;
  },
): React.ReactElement {
  return useCssElement(ScrollViewBase, props as Record<string, unknown>, scrollMapping) as React.ReactElement;
}

export function TwTouchableHighlight(
  props: TouchableHighlightProps & { className?: string },
): React.ReactElement {
  return useCssElement(TouchableHighlightBase, props as Record<string, unknown>, viewMapping) as React.ReactElement;
}

export function TwLink(props: LinkProps & { className?: string }): React.ReactElement {
  return useCssElement(LinkBase, props as unknown as Record<string, unknown>, viewMapping) as React.ReactElement;
}
