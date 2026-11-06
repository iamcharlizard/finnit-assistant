import * as React from 'react';
import { Provider as UrqlProvider, type Client, type CombinedError } from 'urql';

import { isLocale } from '@finnit/core/i18n/locales';

import { graphqlClient, onSessionEnded, resetGraphqlClient } from '@/lib/graphql/client';
import { useLocale } from '@/lib/i18n/i18n-provider';
import { requestGoogleIdToken, signOutFromGoogle } from '@/lib/google-signin';
import {
  clearSession,
  readItem,
  saveTokens,
  writeItem,
  type AuthProviderKind,
} from '@/lib/session/storage';

// "Mantener sesión iniciada" was off last time: this start ends that session.
if (readItem('remember') === 'false') void clearSession();

export type UserRole = 'user' | 'admin';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isMaster: boolean;
  locale: string | null;
  avatar: { source: 'uploaded' | 'google'; url: string; version: string | null } | null;
  privacy: { hasPin: boolean; unlocked: boolean };
}

const ME_QUERY = `query Me {
  me { id name email role isMaster locale avatar { source url version } }
  privacyStatus { hasPin unlocked }
}`;

const AUTH_FIELDS = 'accessToken refreshToken';

const SIGN_IN_MUTATION = `mutation SignIn($input: SignInInput!) { signIn(input: $input) { ${AUTH_FIELDS} } }`;
const SIGN_IN_WITH_GOOGLE_MUTATION = `mutation SignInWithGoogle($input: SignInWithGoogleInput!) {
  signInWithGoogle(input: $input) { ${AUTH_FIELDS} }
}`;
const UPDATE_PREFERENCES_MUTATION = `mutation UpdateMyPreferences($input: UpdateMyPreferencesInput!) {
  updateMyPreferences(input: $input) { id locale }
}`;

/** Why sign-in failed: the login screen shows `login.errors.<code>`. */
export type LoginError =
  | 'missingFields'
  | 'unavailable'
  | 'failed'
  | 'invalidCredentials'
  | 'tooManyAttempts'
  | 'google_no_access'
  | 'google_failed'
  | 'google_unavailable';

/** `cancelled`: the user closed Google's picker, show nothing. */
export type LoginOutcome = { error?: LoginError; cancelled?: boolean };

type Status = 'loading' | 'signedOut' | 'signedIn';

interface AuthContextValue {
  status: Status;
  user: AuthUser | null;
  /** Kept for the screens not migrated yet. */
  isLoading: boolean;
  /** `remember` off: the session ends when the app starts again. */
  login: (email: string, password: string, remember?: boolean) => Promise<LoginOutcome>;
  signInWithGoogle: (remember?: boolean) => Promise<LoginOutcome>;
  logout: () => Promise<void>;
  /** Reload the user (after changing the name, photo, language or privacy PIN). */
  refreshUser: () => Promise<void>;
  /** Save the language preference in the account (and switch to it now). */
  saveLocale: (locale: 'es' | 'en') => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

/** Message the API uses when GOOGLE_CLIENT_IDS is not set on the server. */
const API_GOOGLE_DISABLED = 'Google sign-in is not available';

function errorCode(error: CombinedError | undefined): string | undefined {
  return error?.graphQLErrors[0]?.extensions?.code as string | undefined;
}

function googleError(error: CombinedError): LoginError {
  if (error.networkError) return 'unavailable';
  const gqlError = error.graphQLErrors[0];
  if (gqlError?.extensions?.code === 'FORBIDDEN') {
    return gqlError.message === API_GOOGLE_DISABLED ? 'google_unavailable' : 'google_no_access';
  }
  return 'google_failed';
}

/**
 * The session: tokens in secure storage, the signed-in user from `me`,
 * and the GraphQL client (a fresh one per session, so no data from the
 * previous user stays in the cache). Access is invitation-only: there is
 * no sign-up.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setLocale } = useLocale();
  const [client, setClient] = React.useState<Client>(graphqlClient);
  const [status, setStatus] = React.useState<Status>(() =>
    readItem('accessToken') && readItem('remember') !== 'false' ? 'loading' : 'signedOut',
  );
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const clientRef = React.useRef(client);
  clientRef.current = client;

  const endSession = React.useCallback(async () => {
    const provider = readItem('provider');
    await clearSession();
    setUser(null);
    setStatus('signedOut');
    setClient(resetGraphqlClient());
    if (provider === 'google') await signOutFromGoogle();
  }, []);

  const loadUser = React.useCallback(async (): Promise<boolean> => {
    const result = await clientRef.current
      .query<{ me: Omit<AuthUser, 'privacy'>; privacyStatus: AuthUser['privacy'] }>(
        ME_QUERY,
        {},
        { requestPolicy: 'network-only' },
      )
      .toPromise();
    const me = result.data?.me;
    if (!me) {
      // Offline: keep the session and try again later; rejected: sign out.
      if (result.error?.networkError) return false;
      await endSession();
      return false;
    }
    setUser({ ...me, privacy: result.data!.privacyStatus });
    setStatus('signedIn');
    if (isLocale(me.locale)) setLocale(me.locale);
    return true;
  }, [endSession, setLocale]);

  React.useEffect(() => {
    if (status === 'loading') void loadUser();
    // Only on start: later loads are explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => onSessionEnded(() => void endSession()), [endSession]);

  const startSession = React.useCallback(
    async (
      tokens: { accessToken: string; refreshToken: string },
      provider: AuthProviderKind,
      remember: boolean,
    ) => {
      await saveTokens(tokens, provider);
      await writeItem('remember', remember ? null : 'false');
      const fresh = resetGraphqlClient();
      clientRef.current = fresh;
      setClient(fresh);
      await loadUser();
    },
    [loadUser],
  );

  const value = React.useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      isLoading: status === 'loading',
      async login(email, password, remember = true) {
        if (!email.trim() || !password) return { error: 'missingFields' };
        const result = await clientRef.current
          .mutation<{ signIn: { accessToken: string; refreshToken: string } }>(SIGN_IN_MUTATION, {
            input: { email: email.trim(), password },
          })
          .toPromise();
        if (result.data?.signIn) {
          await startSession(result.data.signIn, 'password', remember);
          return {};
        }
        if (errorCode(result.error) === 'TOO_MANY_REQUESTS') return { error: 'tooManyAttempts' };
        if (result.error?.networkError) return { error: 'unavailable' };
        // Same message for unknown email and wrong password (no account probing).
        return { error: result.error?.graphQLErrors.length ? 'invalidCredentials' : 'failed' };
      },
      async signInWithGoogle(remember = true) {
        const google = await requestGoogleIdToken();
        if (google.type === 'cancelled') return { cancelled: true };
        if (google.type === 'unavailable') return { error: 'google_unavailable' };
        if (google.type === 'error') return { error: 'google_failed' };
        const result = await clientRef.current
          .mutation<{ signInWithGoogle: { accessToken: string; refreshToken: string } }>(
            SIGN_IN_WITH_GOOGLE_MUTATION,
            { input: { idToken: google.idToken } },
          )
          .toPromise();
        if (!result.data?.signInWithGoogle) {
          // Forget the Google account so the picker shows again next time.
          await signOutFromGoogle();
          return { error: result.error ? googleError(result.error) : 'google_failed' };
        }
        await startSession(result.data.signInWithGoogle, 'google', remember);
        return {};
      },
      logout: endSession,
      async refreshUser() {
        await loadUser();
      },
      async saveLocale(locale) {
        setLocale(locale);
        if (status !== 'signedIn') return;
        await clientRef.current
          .mutation(UPDATE_PREFERENCES_MUTATION, { input: { locale } })
          .toPromise();
        setUser((current) => (current ? { ...current, locale } : current));
      },
    }),
    [status, user, startSession, endSession, loadUser, setLocale],
  );

  return (
    <AuthContext.Provider value={value}>
      <UrqlProvider value={client}>{children}</UrqlProvider>
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = React.useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within <AuthProvider>');
  return context;
}
