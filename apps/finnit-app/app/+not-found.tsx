import { Stack } from 'expo-router';

import { TwLink, TwText, TwView } from '@/lib/tw';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <TwView className="flex-1 items-center justify-center bg-background p-5">
        <TwText className="text-title-lg text-on-background">This screen does not exist.</TwText>
        <TwLink href="/" className="mt-4 py-4">
          <TwText className="text-body-md text-primary">Go to home screen!</TwText>
        </TwLink>
      </TwView>
    </>
  );
}
