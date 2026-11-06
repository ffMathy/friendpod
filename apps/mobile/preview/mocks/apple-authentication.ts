/** Preview fake of expo-apple-authentication: available, and signing in returns dummy tokens. */
export const AppleAuthenticationScope = { FULL_NAME: 0, EMAIL: 1 } as const;
export const AppleAuthenticationButtonType = { SIGN_IN: 0, CONTINUE: 1, SIGN_UP: 2 } as const;
export const AppleAuthenticationButtonStyle = { WHITE: 0, WHITE_OUTLINE: 1, BLACK: 2 } as const;
export const AppleAuthenticationCredentialState = { REVOKED: 0, AUTHORIZED: 1, NOT_FOUND: 2, TRANSFERRED: 3 } as const;

export const isAvailableAsync = async (): Promise<boolean> => true;
export const signInAsync = async (_options?: unknown) => ({
  user: 'preview-apple-user',
  identityToken: 'preview-apple-identity-token',
  authorizationCode: 'preview-apple-authorization-code',
  state: null,
  fullName: null,
  email: null,
  realUserStatus: 1,
});
export const refreshAsync = signInAsync;
export const signOutAsync = signInAsync;
export const getCredentialStateAsync = async (): Promise<number> => AppleAuthenticationCredentialState.AUTHORIZED;
export const addRevokeListener = () => ({ remove: () => undefined });
export const AppleAuthenticationButton = () => null;
