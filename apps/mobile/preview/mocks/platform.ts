/**
 * react-native-web's Platform as the app's own code (app/, src/) sees it in the preview: OS is the scenario's platform
 * (iOS by default, like the storyboards), so platform-specific UI such as Sign in with Apple renders as on a phone.
 * Libraries keep the real one ('web'). Mapped in preview/metro.cjs; preview/babel-transformer.cjs keeps the app's
 * `Platform.OS` reads from being inlined as 'web' at build time.
 */
import { preview } from '../runtime/state';

type Specifics<T> = { ios?: T; android?: T; native?: T; web?: T; default?: T };

const os = preview().platform;

const Platform = {
  OS: os,
  Version: os === 'ios' ? '18.0' : 35,
  isPad: false,
  isTV: false,
  isTesting: false,
  constants: { osVersion: os === 'ios' ? '18.0' : '15', reactNativeVersion: { major: 0, minor: 88, patch: 1 } },
  select<T>(spec: Specifics<T>): T | undefined {
    if (os in spec) return spec[os];
    if ('native' in spec) return spec.native;
    return spec.default;
  },
};

export default Platform;
