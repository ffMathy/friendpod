/**
 * Expo app config, driven by APP_ENV (DESIGN.md §11, §13). Evaluated by Expo CLI / EAS in Node.
 *
 *   APP_ENV                  development | staging | production (default: development)
 *   GOOGLE_SERVICES_PLIST    EAS file env var: GoogleService-Info.plist for this environment
 *   GOOGLE_SERVICES_JSON     EAS file env var: google-services.json for this environment
 *   GOOGLE_WEB_CLIENT_ID     OAuth web client id (Firebase console, Auth > Google), needed for Google ID tokens
 *   EAS_PROJECT_ID           set once `eas init` has linked the project
 *   EXPO_PUBLIC_EMBEDDER     `stub` lets a development prebuild go without the bundled model (withBundledModel)
 *
 * Development falls back to committed placeholders for the `demo-grouper` emulator project; staging and
 * production refuse to build without their real files.
 */
import type { ConfigContext, ExpoConfig } from 'expo/config';

type AppEnv = 'development' | 'staging' | 'production';

interface EnvSettings {
  readonly name: string;
  /** iOS bundle id and Android package. Placeholder reverse-DNS until the company domain is fixed. */
  readonly appId: string;
  readonly scheme: string;
  /** Firebase project whose Hosting domain serves the email-link handler (`/__/auth/links`). */
  readonly linkProjectId: string;
  readonly apsEnvironment: 'development' | 'production';
  readonly appAttestEnvironment: 'development' | 'production';
}

/** Brand colours for the icon background and the splash (src/components/theme.ts: primary, dark page). */
const BRAND_GREEN = '#1E6B58';
const DARK_PAGE = '#111513';

/**
 * Plus Jakarta Sans, embedded in the native app (expo-font plugin) as well as loaded at start by the root layout.
 * One file per weight; the family names match src/components/theme.ts `FontFamily`. npm workspaces hoist the
 * package to the repository root.
 */
const FONT_DIR = '../../node_modules/@expo-google-fonts/plus-jakarta-sans';
export const FONT_FILES = ['400Regular', '500Medium', '600SemiBold', '700Bold', '800ExtraBold'].map(
  (weight) => `${FONT_DIR}/${weight}/PlusJakartaSans_${weight}.ttf`,
);

/** The native ONNX Runtime the detector thresholds were verified on (core EMBEDDING_MODEL.device.nativeOrt). */
const ORT_NATIVE_VERSION = '1.30.0';
const ENVIRONMENTS: Record<AppEnv, EnvSettings> = {
  development: {
    name: 'Grouper Dev',
    appId: 'dk.grouper.app.dev',
    scheme: 'grouper-dev',
    // Dev builds talk to the emulators; links still need a real Hosting domain, so they use staging's.
    linkProjectId: 'grouper-staging',
    apsEnvironment: 'development',
    appAttestEnvironment: 'development',
  },
  staging: {
    name: 'Grouper Staging',
    appId: 'dk.grouper.app.staging',
    scheme: 'grouper-staging',
    linkProjectId: 'grouper-staging',
    apsEnvironment: 'production',
    appAttestEnvironment: 'production',
  },
  production: {
    name: 'Grouper',
    appId: 'dk.grouper.app',
    scheme: 'grouper',
    linkProjectId: 'grouper-prod',
    apsEnvironment: 'production',
    appAttestEnvironment: 'production',
  },
};

function appEnv(): AppEnv {
  const value = process.env.APP_ENV ?? 'development';
  if (value === 'development' || value === 'staging' || value === 'production') return value;
  throw new Error(`APP_ENV must be development, staging or production (got "${value}")`);
}

function googleServicesFile(env: AppEnv, variable: 'GOOGLE_SERVICES_PLIST' | 'GOOGLE_SERVICES_JSON'): string {
  const fromEas = process.env[variable];
  if (fromEas) return fromEas;
  if (env !== 'development') {
    throw new Error(`${variable} is required for APP_ENV=${env} (an EAS file environment variable)`);
  }
  return variable === 'GOOGLE_SERVICES_PLIST'
    ? './config/firebase/demo-grouper.GoogleService-Info.plist'
    : './config/firebase/demo-grouper.google-services.json';
}

const collected = (type: string) => ({
  NSPrivacyCollectedDataType: `NSPrivacyCollectedDataType${type}`,
  NSPrivacyCollectedDataTypeLinked: true,
  NSPrivacyCollectedDataTypeTracking: false,
  NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
});

export default ({ config }: ConfigContext): ExpoConfig => {
  const env = appEnv();
  const s = ENVIRONMENTS[env];
  const linkDomain = `${s.linkProjectId}.firebaseapp.com`;
  const easProjectId = process.env.EAS_PROJECT_ID;

  return {
    ...config,
    name: s.name,
    slug: 'grouper',
    description: 'Small groups. Real meetups.',
    version: '0.1.0',
    platforms: ['ios', 'android'],
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: s.scheme,
    userInterfaceStyle: 'automatic',
    // Danish and English copy for OS-level prompts (permission dialogs).
    locales: { da: './src/i18n/native/da.json', en: './src/i18n/native/en.json' },
    ios: {
      bundleIdentifier: s.appId,
      icon: './assets/expo.icon',
      supportsTablet: false,
      googleServicesFile: googleServicesFile(env, 'GOOGLE_SERVICES_PLIST'),
      usesAppleSignIn: true,
      associatedDomains: [`applinks:${linkDomain}`],
      entitlements: {
        'aps-environment': s.apsEnvironment,
        'com.apple.developer.devicecheck.appattest-environment': s.appAttestEnvironment,
      },
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        CFBundleAllowMixedLocalizations: true,
      },
      // PRIVACY.md §12.2. Every type is linked to the user and used for app functionality only; no tracking.
      privacyManifests: {
        NSPrivacyTracking: false,
        NSPrivacyTrackingDomains: [],
        NSPrivacyAccessedAPITypes: [
          { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults', NSPrivacyAccessedAPITypeReasons: ['CA92.1'] },
          { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp', NSPrivacyAccessedAPITypeReasons: ['C617.1'] },
          { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime', NSPrivacyAccessedAPITypeReasons: ['35F9.1'] },
          { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace', NSPrivacyAccessedAPITypeReasons: ['E174.1'] },
        ],
        NSPrivacyCollectedDataTypes: [
          'EmailAddress',
          'Name',
          'SensitiveInfo',
          'Health',
          'PhotosorVideos',
          'OtherUserContent',
          'UserID',
          'DeviceID',
          'CoarseLocation',
          'OtherDataTypes',
        ].map(collected),
      },
    },
    android: {
      package: s.appId,
      googleServicesFile: googleServicesFile(env, 'GOOGLE_SERVICES_JSON'),
      adaptiveIcon: {
        backgroundColor: BRAND_GREEN,
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
      // The Firestore offline cache holds sensitive interests and pod docs: keep it out of cloud backups.
      allowBackup: false,
      permissions: ['android.permission.ACCESS_COARSE_LOCATION'],
      blockedPermissions: [
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_BACKGROUND_LOCATION',
        'android.permission.CAMERA',
        'android.permission.RECORD_AUDIO',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        // The system photo picker needs no media permission; Play restricts READ_MEDIA_* to core photo apps.
        'android.permission.READ_MEDIA_IMAGES',
        'android.permission.READ_MEDIA_VIDEO',
        'android.permission.DETECT_SCREEN_CAPTURE',
        'com.google.android.gms.permission.AD_ID',
        // Add-to-calendar opens the system's new-event screen (D11); Grouper never reads or writes calendars itself.
        'android.permission.READ_CALENDAR',
        'android.permission.WRITE_CALENDAR',
        // The RN template adds it for the dev menu overlay; only development builds need it.
        ...(env === 'development' ? [] : ['android.permission.SYSTEM_ALERT_WINDOW']),
      ],
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [{ scheme: 'https', host: linkDomain, pathPrefix: '/__/auth/links' }],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
    plugins: [
      ['expo-router', { sitemap: false }],
      [
        'expo-splash-screen',
        {
          backgroundColor: BRAND_GREEN,
          image: './assets/images/splash-icon.png',
          imageWidth: 96,
          dark: { backgroundColor: DARK_PAGE, image: './assets/images/splash-icon-dark.png' },
        },
      ],
      ['expo-font', { fonts: FONT_FILES }],
      '@react-native-firebase/app',
      '@react-native-firebase/auth',
      '@react-native-firebase/app-check',
      '@react-native-firebase/messaging',
      [
        'expo-build-properties',
        {
          // RNFirebase 27 is SPM-only on iOS and needs dynamic frameworks; Kotlin matches RNFirebase's default.
          ios: { useFrameworks: 'dynamic' },
          android: { minSdkVersion: 24, kotlinVersion: '2.4.0' },
        },
      ],
      // SPM, so GoogleSignIn shares Firebase's SPM copies of GoogleUtilities/GTMSessionFetcher.
      ['@react-native-google-signin/google-signin', { iosDependencyManager: 'spm' }],
      'expo-apple-authentication',
      ['expo-localization', { supportedLocales: { ios: ['da', 'en'], android: ['da', 'en'] } }],
      [
        'expo-location',
        {
          locationWhenInUsePermission: 'Grouper uses your approximate location once to find your area. It is converted to a map cell on your phone and never stored.',
          locationAlwaysAndWhenInUsePermission: false,
          locationAlwaysPermission: false,
          motionUsagePermission: false,
          locationFullAccuracyPermission: false,
          isIosReducedAccuracyByDefault: true,
          isIosBackgroundLocationEnabled: false,
          isAndroidBackgroundLocationEnabled: false,
          isAndroidForegroundServiceEnabled: false,
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission: 'Grouper lets you choose one profile photo. Only people in a confirmed pod with you can see it.',
          cameraPermission: false,
          microphonePermission: false,
        },
      ],
      ['expo-secure-store', { faceIDPermission: false, configureAndroidBackup: true }],
      // iOS counterpart of `allowBackup: false`: Firestore's offline cache stays out of iCloud backups.
      './plugins/withFirestoreBackupExclusion.js',
      // On-device embedding (D1): pins the native ONNX Runtime under onnxruntime-react-native on both platforms.
      ['./plugins/withOrtPinned.js', { version: ORT_NATIVE_VERSION }],
      // The pinned model ships inside the app (founder decision 2026-11-04): fetched and verified by
      // `npm run fetch-model` (EAS: eas-build-pre-install), copied into the iOS bundle and Android assets at prebuild.
      './plugins/withBundledModel.js',
      // DESIGN-DEVIATION: expo-screen-capture and expo-image-manipulator (SDK 58) ship no config plugin,
      // and of RNFirebase 27 only app, auth, app-check and messaging do; the rest autolink without one.
      // expo-calendar's plugin is left out on purpose: it only adds calendar permissions, and the system new-event
      // sheet needs none (iOS 17+, Android intent). onnxruntime-react-native's own plugin is replaced by withOrtPinned.
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      appEnv: env,
      emailLinkDomain: linkDomain,
      ...(process.env.GOOGLE_WEB_CLIENT_ID ? { googleWebClientId: process.env.GOOGLE_WEB_CLIENT_ID } : {}),
      ...(easProjectId ? { eas: { projectId: easProjectId } } : {}),
    },
  };
};
