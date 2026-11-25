import * as React from 'react';
import type { HostInstance } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { TwView } from '@finnit/ui-native/lib/tw';

/** Space between the screen's pinned toolbar and a stuck heading. */
const STUCK_GAP = 8;

/** What a Screen shares with the headings that stick while it scrolls. */
export interface StickyScroll {
  /** The scroll offset, on the UI thread. */
  scrollY: SharedValue<number>;
  /** The pinned toolbar (`Screen`'s `sticky`): its top in the content and its height; -1 without one. */
  toolbarY: SharedValue<number>;
  toolbarHeight: SharedValue<number>;
  /** The view every position is measured against, and where it starts in the content. */
  body: React.RefObject<HostInstance | null>;
  bodyY: SharedValue<number>;
  /** Runs `measure` whenever the body's layout changes (something above may have moved). */
  onBodyLayout: (measure: () => void) => () => void;
}

export const StickyContext = React.createContext<StickyScroll | null>(null);

/**
 * A group whose heading sticks under the screen's toolbar while the
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

  const measure = React.useCallback(() => {
    const body = sticky?.body.current;
    if (!body || !group.current) return;
    group.current.measureLayout(body, (_x, y, _w, h) => {
      top.value = sticky.bodyY.value + y;
      height.value = h;
    });
  }, [sticky, top, height]);

  React.useEffect(() => sticky?.onBodyLayout(measure), [sticky, measure]);

  const scrollY = sticky?.scrollY;
  const toolbarY = sticky?.toolbarY;
  const toolbarHeight = sticky?.toolbarHeight;
  const style = useAnimatedStyle(() => {
    if (!scrollY || !toolbarY || !toolbarHeight || top.value < 0) return {};
    // Where stuck headings sit in the viewport: under the toolbar (pinned
    // at the top once scrolled past, else still on its way up).
    const stuckAt =
      toolbarY.value < 0
        ? STUCK_GAP
        : Math.max(toolbarY.value - scrollY.value, 0) +
          toolbarHeight.value +
          STUCK_GAP;
    const shift = scrollY.value + stuckAt - top.value;
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
          headingHeight.value = event.nativeEvent.layout.height;
        }}
      >
        {heading}
      </Animated.View>
      {children}
    </TwView>
  );
}
