/* eslint-disable @typescript-eslint/no-require-imports -- loaded by metro.config.js with require(). */
/**
 * Web-only module aliases for the preview harness (preview/README.md). Called from metro.config.js when
 * EXPO_PUBLIC_PREVIEW=1. Every rule below is guarded by `platform === 'web'`, so iOS and Android bundles resolve
 * exactly as without the preview.
 *
 * - The first import of expo-router's entry (`@expo/metro-runtime`) goes to preview/runtime/boot.ts, which installs the
 *   scenario (fixed clock, fixture data, network stubs) before any app module runs, then loads the real runtime.
 * - Native-only modules go to the fakes in preview/mocks/, which read the selected scenario.
 * - Platform imported by the app's own code (app/, src/) reports the scenario's OS (iOS by default, like the
 *   storyboards); libraries keep react-native-web's 'web'. Production builds inline `Platform.OS`, so app files are
 *   transformed through babel-transformer.cjs, which keeps those reads dynamic (web only, app files only).
 * - `react` imported by react-dom gets react-dom's version string (mocks/react-for-react-dom.js): the workspace pins
 *   react 19.3.0 but react-dom 19.3.1 is installed, and react-dom refuses to render with a different React version.
 */
const path = require('path');

/** Package name (or deep import) → mock file in preview/mocks. */
const MOCKS = {
  '@react-native-firebase/app': 'firebase-app.ts',
  '@react-native-firebase/app-check': 'firebase-app-check.ts',
  '@react-native-firebase/auth': 'firebase-auth.ts',
  '@react-native-firebase/firestore': 'firebase-firestore.ts',
  '@react-native-firebase/functions': 'firebase-functions.ts',
  '@react-native-firebase/messaging': 'firebase-messaging.ts',
  '@react-native-firebase/storage': 'firebase-storage.ts',
  '@react-native-google-signin/google-signin': 'google-signin.ts',
  'expo-apple-authentication': 'apple-authentication.ts',
  'expo-calendar': 'calendar.ts',
  'expo-calendar/legacy': 'calendar.ts',
  'expo-localization': 'localization.ts',
  'expo-notifications': 'notifications.ts',
  'expo-screen-capture': 'screen-capture.ts',
  'expo-secure-store': 'secure-store.ts',
  'onnxruntime-react-native': 'onnxruntime.ts',
};

/**
 * @param {import('metro-config').MetroConfig & { resolver: object }} config  Expo's default config, mutated in place.
 * @param {string} projectRoot  apps/mobile
 */
function withPreview(config, projectRoot) {
  const previewRoot = __dirname;
  const mocksRoot = path.join(previewRoot, 'mocks');
  const appRoots = [path.join(projectRoot, 'app') + path.sep, path.join(projectRoot, 'src') + path.sep];
  const upstream = config.resolver.resolveRequest;
  const file = (p) => ({ type: 'sourceFile', filePath: p });

  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (platform === 'web') {
      const origin = context.originModulePath || '';
      if (moduleName === '@expo/metro-runtime' && /expo-router[\\/]entry-classic\.js$/.test(origin)) {
        return file(path.join(previewRoot, 'runtime', 'boot.ts'));
      }
      const fromMocks = origin.startsWith(mocksRoot + path.sep);
      if (!fromMocks) {
        const mock = MOCKS[moduleName];
        if (mock) return file(path.join(mocksRoot, mock));
        if (moduleName.startsWith('@react-native-firebase/')) return file(path.join(mocksRoot, 'firebase-unsupported.ts'));
        const fromApp = appRoots.some((root) => origin.startsWith(root));
        // babel-plugin-react-native-web rewrites `import { Platform } from 'react-native'` to the per-export module.
        if (fromApp && /^react-native-web\/dist\/(?:cjs\/)?exports\/Platform(?:\/index(?:\.js)?)?$/.test(moduleName)) {
          return file(path.join(mocksRoot, 'platform.ts'));
        }
        if (fromApp && moduleName === 'react-native') return file(path.join(mocksRoot, 'react-native.ts'));
        if (moduleName === 'react' && /[\\/]node_modules[\\/]react-dom[\\/]/.test(origin)) {
          return file(path.join(mocksRoot, 'react-for-react-dom.js'));
        }
      }
    }
    return (upstream ?? context.resolveRequest)(context, moduleName, platform);
  };

  // Keeps `Platform.OS` / `Platform.select` in app code from being inlined as 'web' (see babel-transformer.cjs).
  config.transformer = { ...config.transformer, babelTransformerPath: path.join(previewRoot, 'babel-transformer.cjs') };

  // EXPO_PUBLIC_* values are inlined into the transformed modules; key the transform cache on them, so a web build
  // made with other values (or without the preview) never serves stale modules to a preview build.
  const publicEnv = Object.keys(process.env)
    .filter((k) => k.startsWith('EXPO_PUBLIC_'))
    .sort()
    .map((k) => `${k}=${process.env[k]}`)
    .join(';');
  config.cacheVersion = `${config.cacheVersion ?? ''}|preview|${publicEnv}`;
  return config;
}

module.exports = { withPreview };
