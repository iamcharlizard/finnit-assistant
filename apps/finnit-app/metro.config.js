const { getDefaultConfig } = require('expo/metro-config');
const { withNativewind } = require('nativewind/metro');

// Expo configures monorepos automatically (watch folders, node_modules lookup).
const config = getDefaultConfig(__dirname);

module.exports = withNativewind(config, {
  input: './global.css',
  inlineVariables: false,
  globalClassNamePolyfill: false,
});
