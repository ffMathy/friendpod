/* eslint-disable @typescript-eslint/no-require-imports -- Metro loads transformers with require(). */
/**
 * Expo's Babel transformer, plus one preview-only change (preview/metro.cjs installs it when EXPO_PUBLIC_PREVIEW=1):
 * in the app's own files (app/, src/) on web, `Platform.OS` and `Platform.select` are written as `(0, Platform).OS` and
 * `(0, Platform).select`, which the production build's inlining (babel-preset-expo's define and Platform.select
 * plugins, Metro's inline plugin) does not recognise, so they read the preview's Platform at run time
 * (mocks/platform.ts: iOS by default, like the storyboards). Every other file, platform and build is untouched.
 */
const path = require('path');
const upstream = require('@expo/metro-config/build/babel-transformer');

const appRoot = path.dirname(__dirname);
const APP_DIRS = [path.join(appRoot, 'app') + path.sep, path.join(appRoot, 'src') + path.sep];

function isAppFile(filename, projectRoot) {
  const abs = path.isAbsolute(filename) ? filename : path.resolve(projectRoot ?? appRoot, filename);
  return APP_DIRS.some((dir) => abs.startsWith(dir));
}

module.exports = {
  ...upstream,
  transform(args) {
    if (args.options?.platform === 'web' && isAppFile(args.filename, args.options.projectRoot)) {
      return upstream.transform({ ...args, src: args.src.replace(/(?<![.\w$])Platform\.(OS|select)\b/g, '(0, Platform).$1') });
    }
    return upstream.transform(args);
  },
  getCacheKey(...args) {
    return `${upstream.getCacheKey ? upstream.getCacheKey(...args) : ''}:grouper-preview-platform-v2`;
  },
};
