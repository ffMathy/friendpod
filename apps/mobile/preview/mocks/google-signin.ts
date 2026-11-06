/** Preview fake of @react-native-google-signin/google-signin: a successful sign-in with a dummy ID token. */
export const statusCodes = {
  SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
  IN_PROGRESS: 'IN_PROGRESS',
  PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  SIGN_IN_REQUIRED: 'SIGN_IN_REQUIRED',
} as const;

const success = { type: 'success' as const, data: { idToken: 'preview-google-id-token', user: { id: 'preview', email: 'preview@example.com' } } };

export const GoogleSignin = {
  configure: (_options?: unknown): void => undefined,
  hasPlayServices: async (): Promise<boolean> => true,
  signIn: async () => success,
  signInSilently: async () => success,
  signOut: async (): Promise<null> => null,
  revokeAccess: async (): Promise<null> => null,
  getTokens: async () => ({ idToken: 'preview-google-id-token', accessToken: 'preview' }),
  getCurrentUser: () => null,
  hasPreviousSignIn: () => false,
};

export const isSuccessResponse = (r: { type?: string } | null | undefined): boolean => r?.type === 'success';
export const isCancelledResponse = (r: { type?: string } | null | undefined): boolean => r?.type === 'cancelled';
export const isErrorWithCode = (e: unknown): boolean => typeof e === 'object' && e !== null && 'code' in e;
export const GoogleSigninButton = () => null;
