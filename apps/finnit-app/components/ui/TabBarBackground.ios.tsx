import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TAB_BAR_HEIGHT = 49;

export default function BlurTabBarBackground() {
  return (
    <BlurView
      tint="systemChromeMaterial"
      intensity={100}
      style={StyleSheet.absoluteFill}
    />
  );
}

export function useBottomTabOverflow() {
  const { bottom } = useSafeAreaInsets();
  return bottom + TAB_BAR_HEIGHT;
}
