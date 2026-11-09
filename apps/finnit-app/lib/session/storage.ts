import * as SecureStore from 'expo-secure-store';

/**
 * What the app keeps in the device's secure storage (Keychain / Keystore).
 * Tokens never go anywhere else.
 */
const KEYS = {
  accessToken: 'accessToken',
  refreshToken: 'refreshToken',
  provider: 'authProvider',
  privacyToken: 'privacyUnlockToken',
  privacyExpiresAt: 'privacyUnlockExpiresAt',
  locale: 'locale',
  appearance: 'appearance',
  themePreview: 'themePreview',
  /** 'false': sign out when the app starts again ("Mantener sesión iniciada" off). */
  remember: 'rememberSession',
  /** '1': amounts hidden on this device ("Ocultar montos"). */
  hideAmounts: 'hideAmounts',
  /** 'off': don't suggest creating a privacy PIN again. */
  pinSuggestion: 'pinSuggestion',
} as const;

type Key = keyof typeof KEYS;

export function readItem(key: Key): string | null {
  try {
    return SecureStore.getItem(KEYS[key]);
  } catch {
    return null;
  }
}

export async function writeItem(key: Key, value: string | null): Promise<void> {
  try {
    if (value === null) await SecureStore.deleteItemAsync(KEYS[key]);
    else await SecureStore.setItemAsync(KEYS[key], value);
  } catch {
    // Storage unavailable (e.g. locked device): the app works without it.
  }
}

export type AuthProviderKind = 'password' | 'google';

export async function saveTokens(
  tokens: { accessToken: string; refreshToken: string },
  provider?: AuthProviderKind,
): Promise<void> {
  await Promise.all([
    writeItem('accessToken', tokens.accessToken),
    writeItem('refreshToken', tokens.refreshToken),
    provider ? writeItem('provider', provider) : Promise.resolve(),
  ]);
}

export async function clearSession(): Promise<void> {
  await Promise.all(
    (['accessToken', 'refreshToken', 'provider', 'privacyToken', 'privacyExpiresAt', 'remember'] as Key[]).map(
      (key) => writeItem(key, null),
    ),
  );
}

/**
 * The privacy unlock (after entering the privacy PIN): the API's
 * short-lived token, sent as `x-privacy-unlock` until it expires.
 */
export function privacyUnlockToken(now = Date.now()): string | null {
  const token = readItem('privacyToken');
  const expiresAt = Date.parse(readItem('privacyExpiresAt') ?? '');
  return token && Number.isFinite(expiresAt) && expiresAt > now ? token : null;
}

export async function savePrivacyUnlock(token: string | null, expiresAt?: string) {
  await Promise.all([
    writeItem('privacyToken', token),
    writeItem('privacyExpiresAt', token ? (expiresAt ?? null) : null),
  ]);
}
