import * as React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type HostInstance,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import {
  CARD_MARGIN,
  cardPlacement,
  spotlightRect,
  type Rect,
} from '@finnit/core/onboarding/tour';

import { TourCard } from './tour-card';
import type { TourLabels, TourStep } from './tour-context';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const EASE = Easing.bezier(0.32, 0.72, 0, 1);
const DURATION = 320;

interface TourOverlayProps {
  step: TourStep;
  index: number;
  total: number;
  /** The highlighted element in window coordinates; null: no hole; undefined: still looking. */
  target: Rect | null | undefined;
  labels: TourLabels;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

/**
 * Dims the whole screen except a rounded hole around the step's element
 * (one SVG path, the screen with the hole cut out by the even-odd rule),
 * and floats the step's card above or below it. The hole glides from one
 * element to the next.
 */
export function TourOverlay({
  step,
  index,
  total,
  target,
  labels,
  onNext,
  onBack,
  onSkip,
}: TourOverlayProps) {
  const screen = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  // The overlay may not start at the window's origin: targets are measured in the window.
  const [origin, setOrigin] = React.useState({ x: 0, y: 0 });
  const rootRef = React.useRef<HostInstance>(null);
  const [cardHeight, setCardHeight] = React.useState(0);

  const hole = target
    ? spotlightRect(
        {
          ...target,
          x: target.x - origin.x,
          y: target.y - origin.y,
        },
        screen,
      )
    : null;

  // Without a target the hole shrinks to a point in the middle.
  const goal = hole ?? {
    x: screen.width / 2,
    y: screen.height / 2,
    width: 0,
    height: 0,
    radius: 0,
  };
  const x = useSharedValue(goal.x);
  const y = useSharedValue(goal.y);
  const w = useSharedValue(goal.width);
  const h = useSharedValue(goal.height);
  const r = useSharedValue(goal.radius);

  React.useEffect(() => {
    const timing = { duration: reduceMotion ? 0 : DURATION, easing: EASE };
    x.value = withTiming(goal.x, timing);
    y.value = withTiming(goal.y, timing);
    w.value = withTiming(goal.width, timing);
    h.value = withTiming(goal.height, timing);
    r.value = withTiming(goal.radius, timing);
  }, [
    goal.x,
    goal.y,
    goal.width,
    goal.height,
    goal.radius,
    reduceMotion,
    x,
    y,
    w,
    h,
    r,
  ]);

  const width = screen.width;
  const height = screen.height;
  const pathProps = useAnimatedProps(() => {
    const rr = Math.min(r.value, w.value / 2, h.value / 2);
    const left = x.value;
    const top = y.value;
    const right = left + w.value;
    const bottom = top + h.value;
    return {
      d:
        `M0 0H${width}V${height}H0Z ` +
        `M${left + rr} ${top}H${right - rr}` +
        `A${rr} ${rr} 0 0 1 ${right} ${top + rr}V${bottom - rr}` +
        `A${rr} ${rr} 0 0 1 ${right - rr} ${bottom}H${left + rr}` +
        `A${rr} ${rr} 0 0 1 ${left} ${bottom - rr}V${top + rr}` +
        `A${rr} ${rr} 0 0 1 ${left + rr} ${top}Z`,
    };
  });

  const placement = cardPlacement({
    hole,
    cardHeight,
    screenHeight: height,
    insets,
  });

  return (
    <View
      ref={rootRef}
      style={StyleSheet.absoluteFill}
      accessibilityViewIsModal
      onLayout={() =>
        rootRef.current?.measureInWindow((ox, oy) => {
          if (ox !== origin.x || oy !== origin.y) setOrigin({ x: ox, y: oy });
        })
      }
    >
      <Animated.View
        entering={reduceMotion ? undefined : FadeIn.duration(200)}
        exiting={reduceMotion ? undefined : FadeOut.duration(200)}
        style={StyleSheet.absoluteFill}
      >
        <Svg width={width} height={height} pointerEvents="none">
          <AnimatedPath
            animatedProps={pathProps}
            fill="rgba(8, 10, 18, 0.66)"
            fillRule="evenodd"
          />
        </Svg>
        {/* A tap anywhere but the card moves on. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel={labels.next}
          onPress={onNext}
        />
      </Animated.View>

      <Animated.View
        key={step.id}
        entering={reduceMotion ? undefined : FadeIn.duration(220).delay(120)}
        style={{
          position: 'absolute',
          left: CARD_MARGIN,
          right: CARD_MARGIN,
          top: placement.top,
          // Measured first while invisible, then placed (once the element is found).
          opacity: cardHeight && target !== undefined ? 1 : 0,
        }}
      >
        <TourCard
          step={step}
          index={index}
          total={total}
          labels={labels}
          onNext={onNext}
          onBack={onBack}
          onSkip={onSkip}
          onLayout={(event: LayoutChangeEvent) =>
            setCardHeight(event.nativeEvent.layout.height)
          }
        />
      </Animated.View>
    </View>
  );
}
