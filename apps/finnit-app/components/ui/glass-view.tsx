import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { BlurView } from 'expo-blur';
import type { ViewStyle, StyleProp } from 'react-native';

interface FinnGlassViewProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  isInteractive?: boolean;
}

export function FinnGlassView({ children, style, isInteractive = false }: FinnGlassViewProps) {
  if (isLiquidGlassAvailable()) {
    return (
      <GlassView isInteractive={isInteractive} style={style}>
        {children}
      </GlassView>
    );
  }

  return (
    <BlurView tint="systemMaterial" intensity={80} style={style}>
      {children}
    </BlurView>
  );
}
