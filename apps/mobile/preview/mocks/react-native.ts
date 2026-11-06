/**
 * `react-native` as the app's own code sees it in the preview when an import is not rewritten to react-native-web's
 * per-export modules: react-native-web, with Platform from ./platform (the scenario's OS). See preview/metro.cjs.
 */
import PreviewPlatform from './platform';

export * from 'react-native';
export const Platform = PreviewPlatform;
