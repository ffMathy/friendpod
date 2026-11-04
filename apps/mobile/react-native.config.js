/**
 * Autolinking overrides. onnxruntime-react-native 1.24.3 ships no react-native.config.js, so its Android package
 * may not be registered, which fails at startup with "Cannot read property 'install' of null" (upstream PR #28266,
 * unreleased). Naming it here registers `OnnxruntimePackage` through autolinking.
 */
module.exports = {
  dependencies: {
    'onnxruntime-react-native': {
      platforms: {
        android: {
          packageImportPath: 'import ai.onnxruntime.reactnative.OnnxruntimePackage;',
          packageInstance: 'new OnnxruntimePackage()',
        },
      },
    },
  },
};
