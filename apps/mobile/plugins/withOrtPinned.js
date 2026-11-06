/**
 * Pins the native ONNX Runtime under onnxruntime-react-native (DESIGN.md §5.1, D1). The npm package asks for
 * `onnxruntime-android:latest.integration` and an unversioned `onnxruntime-c` pod, so every build could pick up a
 * different core; the detector thresholds were verified against one version, so the build must be reproducible.
 *
 * - Android: forces the version for every Gradle project (the library resolves the AAR in its own configuration,
 *   so an app-module `resolutionStrategy` would not reach it).
 * - iOS: names the pod version in the Podfile.
 *
 * - Android, Gradle 9: the library's build.gradle calls `VersionNumber.parse`, a class Gradle 9 no longer exposes, so the
 *   same block hands that project Gradle's internal `VersionNumber` (otherwise `:onnxruntime-react-native` fails to
 *   evaluate and no Android build gets past configuration).
 *
 * Registration of `OnnxruntimePackage` on Android goes through `react-native.config.js` (autolinking) rather than a
 * MainApplication patch, and the package's own `app.plugin.js` is not used: it hard-codes
 * `../node_modules/onnxruntime-react-native`, which does not exist in this hoisted workspace, and autolinking already
 * adds the Gradle project and the pod.
 */
const { withPodfile, withProjectBuildGradle } = require('expo/config-plugins');

const TAG = 'grouper-ort-pinned';
const VERSION = /^\d+\.\d+\.\d+$/;

function block(lines, comment) {
  return [`${comment} @generated begin ${TAG}`, ...lines, `${comment} @generated end ${TAG}`].join('\n');
}

function stripBlock(contents, comment) {
  const re = new RegExp(`\\n?[ \\t]*${comment} @generated begin ${TAG}[\\s\\S]*?${comment} @generated end ${TAG}`, 'g');
  return contents.replace(re, '');
}

/** Appends an `allprojects` force for `com.microsoft.onnxruntime:onnxruntime-android`; idempotent. */
function pinAndroid(buildGradle, version) {
  const body = block(
    [
      'allprojects {',
      '  configurations.all {',
      `    resolutionStrategy.force 'com.microsoft.onnxruntime:onnxruntime-android:${version}'`,
      '  }',
      '}',
      // The library's build.gradle compares React Native versions with `VersionNumber`, which Gradle 9 removed from
      // the public API; give that one project Gradle's internal class under the old name so it evaluates.
      'subprojects { p ->',
      "  if (p.name == 'onnxruntime-react-native') p.ext.VersionNumber = org.gradle.util.internal.VersionNumber",
      '}',
    ],
    '//',
  );
  return `${stripBlock(buildGradle, '//').trimEnd()}\n\n${body}\n`;
}

/** Adds `pod 'onnxruntime-c', '<version>'` right after `use_expo_modules!`; idempotent. */
function pinIos(podfile, version) {
  const clean = stripBlock(podfile, '#');
  const anchor = /^([ \t]*)use_expo_modules!.*$/m;
  const match = anchor.exec(clean);
  // An unpinned runtime would silently change the vectors, so a template change must fail the prebuild.
  if (!match) throw new Error(`${TAG}: no \`use_expo_modules!\` in the Podfile`);
  const indent = match[1];
  const lines = block([`${indent}pod 'onnxruntime-c', '${version}'`], `${indent}#`);
  const end = match.index + match[0].length;
  return `${clean.slice(0, end)}\n${lines}${clean.slice(end)}`;
}

function withOrtPinned(config, props) {
  const version = props && props.version;
  if (typeof version !== 'string' || !VERSION.test(version)) throw new Error(`${TAG}: pass { version: 'x.y.z' }`);
  config = withProjectBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy') throw new Error(`${TAG}: expected a Groovy android/build.gradle`);
    mod.modResults.contents = pinAndroid(mod.modResults.contents, version);
    return mod;
  });
  return withPodfile(config, (mod) => {
    mod.modResults.contents = pinIos(mod.modResults.contents, version);
    return mod;
  });
}

module.exports = withOrtPinned;
module.exports.pinAndroid = pinAndroid;
module.exports.pinIos = pinIos;
