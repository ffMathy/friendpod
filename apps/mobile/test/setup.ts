import { initI18n } from '@/i18n';

jest.mock('react-native-safe-area-context', () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default);

initI18n('en');
