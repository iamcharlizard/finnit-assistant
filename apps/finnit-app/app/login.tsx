import { Redirect } from 'expo-router';

import { useAuth } from '@/contexts/AuthContext';
import { LoginScreen } from '@/screens/login';

export default function Login() {
  const { status } = useAuth();
  if (status === 'signedIn') return <Redirect href="/dashboard" />;
  return <LoginScreen />;
}
