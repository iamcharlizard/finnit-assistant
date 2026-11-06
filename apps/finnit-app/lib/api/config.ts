import Constants from 'expo-constants';

/**
 * Where the Finnit API is: EXPO_PUBLIC_GRAPHQL_URL, or (in development)
 * the Metro host on the API's port, so it works on devices and simulators.
 */
function resolveGraphqlUrl(): string {
  if (process.env.EXPO_PUBLIC_GRAPHQL_URL) return process.env.EXPO_PUBLIC_GRAPHQL_URL;
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) return `http://${hostUri.split(':')[0]}:3000/graphql`;
  return 'http://localhost:3000/graphql';
}

export const GRAPHQL_URL = resolveGraphqlUrl();

/** The API's origin, for its REST endpoints (files, avatars). */
export const API_ORIGIN = GRAPHQL_URL.replace(/\/graphql\/?$/, '');
