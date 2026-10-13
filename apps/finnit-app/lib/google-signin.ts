import { TurboModuleRegistry } from 'react-native';

type GoogleSigninModule = typeof import('@react-native-google-signin/google-signin');

/** Outcome of asking Google for an ID token on the device. */
export type GoogleIdTokenResult =
  | { type: 'success'; idToken: string }
  | { type: 'cancelled' }
  | { type: 'unavailable' }
  | { type: 'error' };

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

let cachedModule: GoogleSigninModule | null | undefined;
let configured = false;

/**
 * Loads the native Google Sign-In module lazily. The library calls
 * `TurboModuleRegistry.getEnforcing` when imported, which throws where the
 * native code is missing (Expo Go, web), so we check first and never import
 * it at the top level.
 */
function loadModule(): GoogleSigninModule | null {
  if (cachedModule !== undefined) return cachedModule;
  cachedModule = null;
  if (process.env.EXPO_OS === 'web') return cachedModule;
  try {
    if (TurboModuleRegistry.get('RNGoogleSignin')) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      cachedModule = require('@react-native-google-signin/google-signin') as GoogleSigninModule;
    }
  } catch {
    cachedModule = null;
  }
  return cachedModule;
}

function isConfiguredForPlatform(): boolean {
  if (!WEB_CLIENT_ID) return false;
  if (process.env.EXPO_OS === 'ios' && !IOS_CLIENT_ID) return false;
  return true;
}

function ensureConfigured(mod: GoogleSigninModule): void {
  if (configured) return;
  mod.GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    iosClientId: IOS_CLIENT_ID,
  });
  configured = true;
}

/**
 * Shows Google's account picker and returns an ID token whose audience is the
 * WEB client id (that is what the API verifies against GOOGLE_CLIENT_IDS).
 */
export async function requestGoogleIdToken(): Promise<GoogleIdTokenResult> {
  const mod = isConfiguredForPlatform() ? loadModule() : null;
  if (!mod) return { type: 'unavailable' };

  const { GoogleSignin, isCancelledResponse, isErrorWithCode, statusCodes } = mod;

  try {
    ensureConfigured(mod);
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (isCancelledResponse(response)) return { type: 'cancelled' };

    const idToken = response.data.idToken;
    if (!idToken) return { type: 'error' };
    return { type: 'success', idToken };
  } catch (error) {
    if (isErrorWithCode(error)) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED || error.code === statusCodes.IN_PROGRESS) {
        return { type: 'cancelled' };
      }
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        return { type: 'unavailable' };
      }
    }
    return { type: 'error' };
  }
}

/** Clears Google's cached account so the picker shows next time. Best effort. */
export async function signOutFromGoogle(): Promise<void> {
  const mod = isConfiguredForPlatform() ? loadModule() : null;
  if (!mod) return;
  try {
    ensureConfigured(mod);
    await mod.GoogleSignin.signOut();
  } catch {
    // ignore: the Finnit session is already cleared
  }
}
