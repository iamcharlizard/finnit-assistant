import * as React from 'react';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  Extrapolation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { useAppTheme } from '../../theme/theme-root';

/** One turn: a third of the way round, so the triangle lands where it started. */
const STEP = 120;
const TURN_MS = 450;
const PAUSE_MS = 300;

/*
 * The Finnit mark (assets/images/brand/finnit-mark-*.svg). Its triangle is
 * equilateral with its centroid at (72, 89.33) and corners ~69.3 away, so
 * this square viewBox puts the centroid in the middle: rotating the view
 * turns the triangle about its own center.
 */
const VIEW_BOX = '2 19.33 140 140';
const FACES = [
  'M38.6 97.2L72 39.3L60.9 20L49.7 39.3L54 46.8L31.7 85.4ZM98.6 124L109.7 104.7L76.3 46.8L69.4 58.6L89.1 92.8L94.3 92.8L101.1 104.7L94.3 116.5ZM23.1 124L34.3 104.7L23.1 85.4L12 104.7Z',
  'M52.3 97.2L72 63.1L69.4 58.6L76.3 46.8L90 46.8L94.3 39.3L72 39.3L38.6 97.2ZM45.4 124L49.7 116.5L94.3 116.5L101.1 104.7L34.3 104.7L23.1 124ZM120.9 124L132 104.7L109.7 104.7L98.6 124Z',
  'M72 39.3L94.3 39.3L83.1 20L60.9 20ZM109.7 104.7L132 104.7L120.9 85.4L112.3 85.4L90 46.8L76.3 46.8ZM34.3 104.7L101.1 104.7L94.3 92.8L54.9 92.8L52.3 97.2L38.6 97.2L31.7 85.4L23.1 85.4Z',
];
const COLORS = {
  light: ['#9aa0f0', '#6c72cb', '#5b61c2'],
  dark: ['#00f5ff', '#6c72cb', '#5b61c2'],
};

interface LogoSpinnerProps {
  size?: number;
  /** Turning: 120° at a time, a short pause, again. */
  spinning?: boolean;
  /**
   * While not spinning, how far a pull has gone (0 → 1): the mark turns
   * with it, up to one step, and fades in.
   */
  progress?: SharedValue<number>;
  accessibilityLabel?: string;
}

/** The Finnit mark as a loader: it turns a third at a time, always landing upright. */
function LogoSpinner({
  size = 32,
  spinning = true,
  progress,
  accessibilityLabel,
}: LogoSpinnerProps) {
  const { scheme } = useAppTheme();
  const colors = COLORS[scheme === 'dark' ? 'dark' : 'light'];
  const turn = useSharedValue(0);
  const active = useSharedValue(spinning ? 1 : 0);

  React.useEffect(() => {
    active.value = spinning ? 1 : 0;
    if (spinning) {
      // The shape repeats every 120° but its shading doesn't (the lit faces
      // move), so never jump back: carry on from where the pull left the
      // mark, and loop over a full turn (360° looks exactly like 0°).
      const from = progress
        ? Math.min(Math.max(progress.value, 0), 1) * STEP
        : 0;
      const first = Math.floor(from / STEP) * STEP + STEP;
      const turnTo = (angle: number) =>
        withSequence(
          withTiming(angle, {
            duration: TURN_MS,
            easing: Easing.inOut(Easing.cubic),
          }),
          withTiming(angle, { duration: PAUSE_MS }),
        );
      turn.value = from;
      turn.value = withSequence(
        turnTo(first),
        withRepeat(
          withSequence(
            turnTo(first + STEP),
            turnTo(first + 2 * STEP),
            turnTo(first + 3 * STEP),
          ),
          -1,
        ),
      );
    } else {
      cancelAnimation(turn);
      turn.value = 0;
    }
    return () => cancelAnimation(turn);
  }, [spinning, turn, active, progress]);

  const style = useAnimatedStyle(() => {
    const pulled = progress ? Math.min(Math.max(progress.value, 0), 1) : 1;
    const angle = active.value ? turn.value : pulled * STEP;
    return {
      opacity: active.value
        ? 1
        : interpolate(pulled, [0, 0.4], [0, 1], Extrapolation.CLAMP),
      transform: [
        { rotate: `${angle}deg` },
        {
          scale: active.value
            ? 1
            : interpolate(pulled, [0, 1], [0.6, 1], Extrapolation.CLAMP),
        },
      ],
    };
  });

  return (
    <Animated.View
      accessible={Boolean(accessibilityLabel)}
      accessibilityRole={accessibilityLabel ? 'progressbar' : undefined}
      accessibilityLabel={accessibilityLabel}
      style={[{ width: size, height: size }, style]}
    >
      <Svg width={size} height={size} viewBox={VIEW_BOX}>
        {FACES.map((d, i) => (
          <Path key={i} d={d} fill={colors[i]} />
        ))}
      </Svg>
    </Animated.View>
  );
}

export { LogoSpinner, type LogoSpinnerProps };
