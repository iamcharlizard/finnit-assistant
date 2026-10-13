import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useMutation, type CombinedError } from 'urql';
import {
  SIGN_IN_MUTATION,
  SIGN_IN_WITH_GOOGLE_MUTATION,
  type AuthUser,
  type SignInResult,
  type SignInInput,
  type SignInWithGoogleInput,
  type SignInWithGoogleResult,
} from '@/lib/graphql/mutations/auth';
import { requestGoogleIdToken, signOutFromGoogle } from '@/lib/google-signin';

type AuthTokens = { accessToken: string; refreshToken: string; user: AuthUser };
type AuthProvider = 'password' | 'google';

/** `cancelled` means the user closed Google's picker: show nothing. */
type LoginOutcome = { error?: string; cancelled?: boolean };

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<LoginOutcome>;
  signInWithGoogle: () => Promise<LoginOutcome>;
  logout: () => Promise<void>;
};

const GOOGLE_NO_ACCESS_MESSAGE =
  'Tu cuenta de Google no tiene acceso a Finnit. Pide acceso al administrador.';
const GOOGLE_GENERIC_ERROR = 'No pudimos iniciar sesión con Google. Intenta de nuevo.';
const GOOGLE_UNAVAILABLE = 'El inicio de sesión con Google no está disponible.';
/** Message the API uses when GOOGLE_CLIENT_IDS is not set on the server. */
const API_GOOGLE_DISABLED = 'Google sign-in is not available';

const AUTH_PROVIDER_KEY = 'authProvider';

const AuthContext = createContext<AuthContextValue | null>(null);

function googleErrorMessage(error: CombinedError): string {
  if (error.networkError) return 'Error de conexión. Intenta de nuevo.';
  const gqlError = error.graphQLErrors[0];
  if (gqlError?.extensions?.code === 'FORBIDDEN') {
    return gqlError.message === API_GOOGLE_DISABLED ? GOOGLE_UNAVAILABLE : GOOGLE_NO_ACCESS_MESSAGE;
  }
  return GOOGLE_GENERIC_ERROR;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, signIn] = useMutation<SignInResult, { input: SignInInput }>(SIGN_IN_MUTATION);
  const [, signInGoogle] = useMutation<SignInWithGoogleResult, { input: SignInWithGoogleInput }>(
    SIGN_IN_WITH_GOOGLE_MUTATION,
  );

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

  async function storeSession(
    { accessToken, refreshToken, user: authUser }: AuthTokens,
    provider: AuthProvider,
  ) {
    await Promise.all([
      SecureStore.setItemAsync('accessToken', accessToken),
      SecureStore.setItemAsync('refreshToken', refreshToken),
      SecureStore.setItemAsync('user', JSON.stringify(authUser)),
      SecureStore.setItemAsync(AUTH_PROVIDER_KEY, provider),
    ]);
    setUser(authUser);
  }

  async function login(email: string, password: string): Promise<LoginOutcome> {
    const result = await signIn({ input: { email, password } });

    if (result.error) {
      const message =
        result.error.graphQLErrors[0]?.message ??
        result.error.networkError?.message ??
        'Error de conexión. Intenta de nuevo.';
      return { error: message };
    }

    await storeSession(result.data!.signIn, 'password');
    return {};
  }

  async function signInWithGoogle(): Promise<LoginOutcome> {
    const google = await requestGoogleIdToken();
    if (google.type === 'cancelled') return { cancelled: true };
    if (google.type === 'unavailable') return { error: GOOGLE_UNAVAILABLE };
    if (google.type === 'error') return { error: GOOGLE_GENERIC_ERROR };

    const result = await signInGoogle({ input: { idToken: google.idToken } });
    if (result.error || !result.data) {
      // Forget the Google account so the picker shows again on the next try.
      await signOutFromGoogle();
      return { error: result.error ? googleErrorMessage(result.error) : GOOGLE_GENERIC_ERROR };
    }

    await storeSession(result.data.signInWithGoogle, 'google');
    return {};
  }

  async function logout() {
    const provider = await SecureStore.getItemAsync(AUTH_PROVIDER_KEY).catch(() => null);
    await Promise.all([
      SecureStore.deleteItemAsync('accessToken'),
      SecureStore.deleteItemAsync('refreshToken'),
      SecureStore.deleteItemAsync('user'),
      SecureStore.deleteItemAsync(AUTH_PROVIDER_KEY),
    ]);
    setUser(null);
    if (provider === 'google') await signOutFromGoogle();
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signInWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
