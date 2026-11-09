import { notifyManager } from '@tanstack/react-query';
import { initI18n } from '@/i18n';

// TanStack batches observer notifications on a timer; run them at once, so a mutation's result reaches the
// component inside the act() of the press that started it.
notifyManager.setScheduler((cb) => cb());

jest.mock('react-native-safe-area-context', () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default);

// What app.config.ts writes for APP_ENV=development; jest has no evaluated app config.
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      name: 'Friendpod Dev',
      slug: 'grouper',
      version: '0.1.0',
      ios: { bundleIdentifier: 'dk.grouper.app.dev' },
      android: { package: 'dk.grouper.app.dev' },
      extra: {
        appEnv: 'development',
        emailLinkDomain: 'grouper-staging.firebaseapp.com',
      },
    },
  },
}));

initI18n('en');
