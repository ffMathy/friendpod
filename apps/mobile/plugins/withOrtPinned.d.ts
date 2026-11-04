import type { ConfigPlugin } from 'expo/config-plugins';

declare const withOrtPinned: ConfigPlugin<{ version: string }> & {
  pinAndroid(buildGradle: string, version: string): string;
  pinIos(podfile: string, version: string): string;
};
export = withOrtPinned;
