import type { ComponentProps } from 'react';
import { Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';

export function HapticTab(props: ComponentProps<typeof Pressable>) {
  return (
    <Pressable
      {...props}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        props.onPressIn?.(ev);
      }}
    />
  );
}
