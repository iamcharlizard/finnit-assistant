import { Client, cacheExchange, fetchExchange } from 'urql';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

function resolveApiUrl(): string {
  if (process.env.EXPO_PUBLIC_GRAPHQL_URL) {
    return process.env.EXPO_PUBLIC_GRAPHQL_URL;
  }
  // In Expo Go / dev client the hostUri is the Metro bundler address (e.g. 192.168.1.5:8081).
  // We swap the Metro port for the API port so it works on physical devices and emulators.
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:3000/graphql`;
  }
  return 'http://localhost:3000/graphql';
}

const API_URL = resolveApiUrl();

export const graphqlClient = new Client({
  url: API_URL,
  fetchOptions: () => {
    const token = SecureStore.getItem('accessToken');
    return {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };
  },
  exchanges: [cacheExchange, fetchExchange],
});
