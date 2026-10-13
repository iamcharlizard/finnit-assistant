import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Dynamic config on top of app.json (Expo passes it in as `config`).
 *
 * Google Sign-In needs the reversed iOS client id registered as a URL scheme
 * on iOS. We only add the library's config plugin when
 * EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME is set, so the app still builds (without
 * Google sign-in) when Google is not configured. See .env.example.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const iosUrlScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME;

  return {
    ...config,
    name: config.name ?? 'finnit-app',
    slug: config.slug ?? 'finnit-app',
    plugins: [
      ...(config.plugins ?? []),
      ...(iosUrlScheme
        ? [['@react-native-google-signin/google-signin', { iosUrlScheme }] as [string, unknown]]
        : []),
    ],
  };
};
