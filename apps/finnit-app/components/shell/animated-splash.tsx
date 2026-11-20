import * as React from 'react';
import {
  Appearance,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';
import { useTranslations } from 'use-intl';

import {
  FinnitMark,
  MARK_ASPECT,
} from '@finnit/ui-native/components/ui/finnit-mark';

import { useAuth } from '@/contexts/AuthContext';

/*
 * The native splash (app.json, expo-splash-screen) follows the system's
 * light or dark, before the user's own choice applies: read it now, at
 * load, so the first frame here matches it exactly.
 */
const LAUNCH_SCHEME = Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
const BACKGROUND = { light: '#f8f9fa', dark: '#12131a' };
const INK = { light: '#1a1b22', dark: '#f8f9fa' };
const MUTED = { light: '#5f6170', dark: '#a6a8b6' };

/*
 * The native splash draws its 1024px icon 200pt wide, and the mark fills
 * 784px of it, centered: that is where the animation starts.
 */
const START_WIDTH = (200 * 784) / 1024;
const END_WIDTH = 52;
const GAP = 12;
const FONT_SIZE = 44;
const LINE_HEIGHT = 52;

const HOLD_MS = 400;
const SHRINK_MS = 800;
const SLIDE_MS = 900;
/** The finished logo stays this long before the app shows. */
const REST_MS = 2000;
const FADE_MS = 600;
const EASE = Easing.bezier(0.32, 0.72, 0, 1);

/**
 * The launch animation, over everything: the native splash's mark shrinks
 * in the middle, then slides left while "finnit" comes out beside it. It
 * stays until the fonts and the saved session have loaded (if the API
 * can't be reached, it says so with "Reintentar"), then fades into the app.
 */
export function AnimatedSplash({ fontsLoaded }: { fontsLoaded: boolean }) {
  const t = useTranslations('common');
  const { status, unreachable, retryConnection } = useAuth();
  const reduceMotion = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const [textWidth, setTextWidth] = React.useState(0);
  const [animated, setAnimated] = React.useState(false);
  const [gone, setGone] = React.useState(false);
  const shrink = useSharedValue(0);
  const slide = useSharedValue(0);
  const shown = useSharedValue(1);

  // The words are measured (in the app's font) before the slide starts.
  const measured = fontsLoaded && textWidth > 0;
  React.useEffect(() => {
    if (!measured) return;
    if (reduceMotion) {
      shrink.value = 1;
      slide.value = 1;
      return;
    }
    shrink.value = withDelay(
      HOLD_MS,
      withTiming(1, { duration: SHRINK_MS, easing: EASE }),
    );
    slide.value = withDelay(
      HOLD_MS + SHRINK_MS,
      withTiming(1, { duration: SLIDE_MS, easing: EASE }),
    );
    const timer = setTimeout(
      () => setAnimated(true),
      HOLD_MS + SHRINK_MS + SLIDE_MS + REST_MS,
    );
    return () => clearTimeout(timer);
  }, [measured, reduceMotion, shrink, slide]);

  // With "Reduce motion" the mark and the words are just there.
  const introDone = reduceMotion ? measured : animated;
  const ready = introDone && fontsLoaded && status !== 'loading';
  React.useEffect(() => {
    if (!ready) return;
    shown.value = withTiming(0, { duration: FADE_MS });
    const timer = setTimeout(() => setGone(true), FADE_MS + 20);
    return () => clearTimeout(timer);
  }, [ready, shown]);

  const scale = END_WIDTH / START_WIDTH;
  // The mark and the words end up centered together.
  const dx = -(GAP + textWidth) / 2;
  const markStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: slide.value * dx },
      { scale: 1 - shrink.value * (1 - scale) },
    ],
  }));
  const wordStyle = useAnimatedStyle(() => ({
    opacity: slide.value,
    transform: [{ translateX: (1 - slide.value) * -24 }],
  }));
  const overlayStyle = useAnimatedStyle(() => ({ opacity: shown.value }));

  if (gone) return null;

  const markHeight = START_WIDTH * MARK_ASPECT;
  const cx = width / 2;
  const cy = height / 2;

  return (
    <Animated.View
      accessible
      accessibilityLabel="Finnit"
      accessibilityLiveRegion="polite"
      // Hide the native splash once this identical first frame is on screen.
      onLayout={() => void SplashScreen.hideAsync()}
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: BACKGROUND[LAUNCH_SCHEME] },
        overlayStyle,
      ]}
    >
      <Animated.View
        style={[
          styles.abs,
          {
            left: cx - START_WIDTH / 2,
            top: cy - markHeight / 2,
            width: START_WIDTH,
            height: markHeight,
          },
          markStyle,
        ]}
      >
        <FinnitMark width={START_WIDTH} scheme={LAUNCH_SCHEME} />
      </Animated.View>
      {fontsLoaded ? (
        <Animated.View
          style={[
            styles.abs,
            { left: cx + dx + END_WIDTH / 2 + GAP, top: cy - LINE_HEIGHT / 2 },
            wordStyle,
          ]}
        >
          <Text
            onLayout={(event) => setTextWidth(event.nativeEvent.layout.width)}
            style={[styles.word, { color: INK[LAUNCH_SCHEME] }]}
          >
            finnit
          </Text>
        </Animated.View>
      ) : null}
      {unreachable && introDone ? (
        <View style={[styles.abs, styles.offline, { top: cy + 72 }]}>
          <Text
            accessibilityRole="alert"
            style={[styles.message, { color: MUTED[LAUNCH_SCHEME] }]}
          >
            {t('unreachable')}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={retryConnection}
            style={({ pressed }) => [
              styles.retry,
              { borderColor: MUTED[LAUNCH_SCHEME], opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Text style={[styles.retryLabel, { color: INK[LAUNCH_SCHEME] }]}>
              {t('retry')}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  word: {
    fontFamily: 'Ubuntu Bold',
    fontSize: FONT_SIZE,
    lineHeight: LINE_HEIGHT,
    letterSpacing: -0.5,
  },
  offline: { left: 32, right: 32, alignItems: 'center', gap: 16 },
  message: { fontFamily: 'Ubuntu', fontSize: 14, textAlign: 'center' },
  retry: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryLabel: { fontFamily: 'Ubuntu Medium', fontSize: 15 },
});
