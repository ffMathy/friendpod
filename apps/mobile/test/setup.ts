import { initI18n } from '@/i18n';

jest.mock('react-native-safe-area-context', () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default);

// What app.config.ts writes for APP_ENV=development; jest has no evaluated app config.
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      name: 'Grouper Dev',
      slug: 'grouper',
      version: '0.1.0',
      ios: { bundleIdentifier: 'dk.grouper.app.dev' },
      android: { package: 'dk.grouper.app.dev' },
      extra: {
        appEnv: 'development',
        emailLinkDomain: 'grouper-staging.firebaseapp.com',
        modelBaseUrl: 'https://storage.googleapis.com/grouper-staging-models/models/eg2-q4-daa72c5/',
      },
    },
  },
}));

initI18n('en');
