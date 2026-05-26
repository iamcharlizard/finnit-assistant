import { View } from 'react-native';
import { Slot } from 'expo-router';
import { BottomNavBar } from '@/components/navigation/bottom-nav-bar';

export default function AppLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Slot />
      <BottomNavBar />
    </View>
  );
}
