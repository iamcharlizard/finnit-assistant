import type * as React from 'react';
import { Platform, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

import { cn } from '../../lib/utils';
import { TwView } from '../../lib/tw';
import { useAppTheme, useElevation } from '../../theme/theme-root';

interface GlassSurfaceProps {
  className?: string;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/**
 * Floating chrome (bottom bar, header, FAB): the web's
 * `glass bg-glass border-glass-border shadow-elevation`. On iOS 26 it is
 * the system's Liquid Glass; elsewhere a blur under the theme's glass tint.
 * Use it only for what floats over scrolling content (cards don't blur).
 */
function GlassSurface({ className, style, children }: GlassSurfaceProps) {
  const { scheme } = useAppTheme();
  const elevation = useElevation();
  const liquid = Platform.OS === 'ios' && isLiquidGlassAvailable();
  return (
    <TwView
      className={cn('overflow-hidden border border-glass-border', className)}
      style={[elevation, style]}
    >
      {liquid ? (
        <GlassView style={StyleSheet.absoluteFill} glassEffectStyle="regular" />
      ) : (
        <>
          <BlurView
            style={StyleSheet.absoluteFill}
            intensity={40}
            tint={scheme === 'dark' ? 'dark' : 'light'}
          />
          <TwView className="absolute inset-0 bg-glass" />
        </>
      )}
      {children}
    </TwView>
  );
}

export { GlassSurface, type GlassSurfaceProps };
