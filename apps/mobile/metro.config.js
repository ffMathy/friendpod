/* eslint-disable @typescript-eslint/no-require-imports -- Metro loads its config with require(). */
/**
 * Metro config: Expo's defaults. The app ships for iOS and Android only; the one addition is the web-only preview
 * harness (preview/README.md), switched on by EXPO_PUBLIC_PREVIEW=1. Without that flag this file is exactly
 * `getDefaultConfig`, and even with it, iOS and Android resolution is untouched (the preview resolver only acts on
 * platform === 'web'). Jest does not read this file.
 */
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

if (process.env.EXPO_PUBLIC_PREVIEW === '1') {
  require('./preview/metro.cjs').withPreview(config, __dirname);
}

module.exports = config;
