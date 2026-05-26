import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useMutation } from 'urql';
import { SIGN_IN_MUTATION, type AuthUser, type SignInResult, type SignInInput } from '@/lib/graphql/mutations/auth';

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, signIn] = useMutation<SignInResult, { input: SignInInput }>(SIGN_IN_MUTATION);

  useEffect(() => {
    const raw = SecureStore.getItem('user');
    if (raw) {
      try {
        setUser(JSON.parse(raw) as AuthUser);
      } catch {
        // ignore corrupted data
      }
    }
    setIsLoading(false);
  }, []);

  async function login(email: string, password: string): Promise<{ error?: string }> {
    const result = await signIn({ input: { email, password } });

    if (result.error) {
      const message =
        result.error.graphQLErrors[0]?.message ??
        result.error.networkError?.message ??
        'Error de conexión. Intenta de nuevo.';
      return { error: message };
    }

    const { accessToken, refreshToken, user: authUser } = result.data!.signIn;

    await Promise.all([
      SecureStore.setItemAsync('accessToken', accessToken),
      SecureStore.setItemAsync('refreshToken', refreshToken),
      SecureStore.setItemAsync('user', JSON.stringify(authUser)),
    ]);

    setUser(authUser);
    return {};
  }

  async function logout() {
    await Promise.all([
      SecureStore.deleteItemAsync('accessToken'),
      SecureStore.deleteItemAsync('refreshToken'),
      SecureStore.deleteItemAsync('user'),
    ]);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
