/**
 * Any @react-native-firebase module the preview has no fake for yet (preview/metro.cjs). Importing it works; calling
 * into it throws, so the gap shows up in the shoot report instead of crashing the bundle. Add a real fake in
 * preview/mocks/ and map it in preview/metro.cjs when a screen needs one.
 */
const unsupported = new Proxy(
  {},
  {
    get(_target, prop) {
      if (prop === '__esModule') return false;
      return () => {
        throw new Error(`preview: this @react-native-firebase module has no preview fake (${String(prop)})`);
      };
    },
  },
);

export default unsupported;
