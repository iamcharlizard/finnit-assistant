import { Redirect } from 'expo-router';

import { useAuth } from '@/contexts/AuthContext';

export default function Index() {
  const { status } = useAuth();
  // AnimatedSplash covers the screen meanwhile.
  if (status === 'loading') return null;
  return <Redirect href={status === 'signedIn' ? '/dashboard' : '/login'} />;
}
