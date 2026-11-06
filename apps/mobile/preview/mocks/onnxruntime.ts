/** Preview fake of onnxruntime-react-native: no on-device model in a browser (the preview builds with the stub embedder). */
export const InferenceSession = {
  create: async (): Promise<never> => {
    throw new Error('preview: no on-device model (EXPO_PUBLIC_EMBEDDER=stub)');
  },
};
export class Tensor {
  constructor(..._args: unknown[]) {
    throw new Error('preview: no on-device model (EXPO_PUBLIC_EMBEDDER=stub)');
  }
}
export const env = {};
