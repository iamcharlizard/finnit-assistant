const { getDefaultConfig } = require('expo/metro-config');
const { withNativewind } = require('nativewind/metro');

// Expo configures monorepos automatically (watch folders, node_modules lookup).
const config = getDefaultConfig(__dirname);

module.exports = withNativewind(config, {
  input: './global.css',
  // 1rem = 16px like the web, so p-4 / text-sm measure the same.
  inlineRem: 16,
  inlineVariables: false,
  globalClassNamePolyfill: false,
});
