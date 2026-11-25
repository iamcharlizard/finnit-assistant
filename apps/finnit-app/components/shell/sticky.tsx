import * as React from 'react';
import type { HostInstance } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { TwView } from '@finnit/ui-native/lib/tw';

/** Space between the top of the scrolling area and a stuck heading. */
const STUCK_GAP = 8;

/** What a Screen shares with the headings that stick while it scrolls. */
export interface StickyScroll {
  /** The scroll offset, on the UI thread. */
  scrollY: SharedValue<number>;
  /** The scroll view's frame on screen: positions are measured against it. */
  viewport: React.RefObject<HostInstance | null>;
  /** Runs `measure` whenever the body's layout changes (something above may have moved). */
  onBodyLayout: (measure: () => void) => () => void;
}

export const StickyContext = React.createContext<StickyScroll | null>(null);

/**
 * A group whose heading sticks at the top of the scrolling area (under
 * the screen's fixed toolbar, if any) while the
 * group's rows are on screen, then leaves with its last row (the web's
 * `sticky` day headings in the history). Outside a Screen the heading
 * just sits on top.
 */
export function StickyGroup({
  heading,
  children,
  className,
}: {
  heading: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const sticky = React.useContext(StickyContext);
  const group = React.useRef<HostInstance>(null);
  // In content coordinates; -1 until measured.
  const top = useSharedValue(-1);
  const height = useSharedValue(0);
  const headingHeight = useSharedValue(0);

  // Its top in the content: where it is on screen, plus how far the
  // content is scrolled (measureLayout against the content gave the
  // wrong offset, so headings stuck too low).
  const measure = React.useCallback(() => {
    const viewport = sticky?.viewport.current;
    const node = group.current;
    if (!viewport || !node) return;
    viewport.measureInWindow((_vx, viewportY) => {
      node.measureInWindow((_x, y, _w, h) => {
        top.set(y - viewportY + sticky.scrollY.get());
        height.set(h);
      });
    });
  }, [sticky, top, height]);

  React.useEffect(() => sticky?.onBodyLayout(measure), [sticky, measure]);

  const scrollY = sticky?.scrollY;
  const style = useAnimatedStyle(() => {
    if (!scrollY || top.value < 0) return {};
    const shift = scrollY.value + STUCK_GAP - top.value;
    const max = Math.max(0, height.value - headingHeight.value);
    return {
      transform: [{ translateY: Math.min(Math.max(shift, 0), max) }],
    };
  });

  return (
    <TwView ref={group} onLayout={measure} className={className}>
      <Animated.View
        style={[{ zIndex: 1 }, style]}
        onLayout={(event) => {
          headingHeight.set(event.nativeEvent.layout.height);
        }}
      >
        {heading}
      </Animated.View>
      {children}
    </TwView>
  );
}
