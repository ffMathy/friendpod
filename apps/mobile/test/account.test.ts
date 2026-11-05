import { consumeAccountDeleted, deleteAccount, requestDataExport, signOut } from '@/features/account/account';

const mockOrder: string[] = [];
const mockUser = { uid: 'me', providerData: [{ providerId: 'apple.com' }] };
jest.mock('@/firebase', () => ({ auth: () => ({ currentUser: mockUser }) }));

const mockRevoke = jest.fn(async (_auth: unknown, _code: string) => {
  mockOrder.push('revokeToken');
});
const mockFirebaseSignOut = jest.fn(async () => {
  mockOrder.push('signOut');
});
jest.mock('@react-native-firebase/auth', () => ({
  revokeToken: (...a: [unknown, string]) => mockRevoke(...a),
  signOut: () => mockFirebaseSignOut(),
}));

const mockCall = jest.fn(async (name: string) => {
  mockOrder.push(name);
  return name === 'exportData' ? { exportId: 'exp1' } : { ok: true };
});
jest.mock('@/firebase/callables', () => ({ callFunction: (name: string) => mockCall(name) }));

const mockReauth = jest.fn();
jest.mock('@/features/auth/reauth', () => ({ reauthenticate: (...a: unknown[]) => mockReauth(...a) }));
jest.mock('@/features/auth/google', () => ({ signOutOfGoogle: async () => undefined }));
const mockEndDeviceSession = jest.fn(async () => {
  mockOrder.push('clearDevice');
});
jest.mock('@/features/account/deviceSession', () => ({ endDeviceSession: () => mockEndDeviceSession() }));

let mockGranted = true;
const mockUnregister = jest.fn(async () => {
  mockOrder.push('deleteToken');
});
jest.mock('@/features/notifications/push', () => ({
  pushPermissionGranted: async () => mockGranted,
  unregisterPush: () => mockUnregister(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockOrder.length = 0;
  mockGranted = true;
  mockUser.providerData = [{ providerId: 'apple.com' }];
  consumeAccountDeleted();
});

describe('delete account (§3.10)', () => {
  it('with Apple: re-authenticates, revokes the fresh code, deletes, then signs out and clears the device', async () => {
    mockReauth.mockResolvedValue({ kind: 'done', appleAuthorizationCode: 'code-123' });
    await expect(deleteAccount()).resolves.toEqual({ kind: 'done' });
    expect(mockReauth).toHaveBeenCalledWith(mockUser, { forDeletion: true });
    expect(mockRevoke).toHaveBeenCalledWith(expect.anything(), 'code-123');
    expect(mockOrder).toEqual(['revokeToken', 'deleteAccount', 'deleteToken', 'signOut', 'clearDevice']);
    expect(consumeAccountDeleted()).toBe(true);
    expect(consumeAccountDeleted()).toBe(false);
  });

  it('retries a failed revocation once and never lets it block the deletion', async () => {
    mockReauth.mockResolvedValue({ kind: 'done', appleAuthorizationCode: 'code-123' });
    mockRevoke.mockRejectedValue(new Error('apple down'));
    await deleteAccount();
    expect(mockRevoke).toHaveBeenCalledTimes(2);
    expect(mockCall).toHaveBeenCalledWith('deleteAccount');
    mockRevoke.mockReset();
  });

  it('without Apple, revokes nothing', async () => {
    mockUser.providerData = [{ providerId: 'google.com' }];
    mockReauth.mockResolvedValue({ kind: 'done', appleAuthorizationCode: null });
    await deleteAccount();
    expect(mockRevoke).not.toHaveBeenCalled();
    expect(mockCall).toHaveBeenCalledWith('deleteAccount');
  });

  it('for an email-link account, stops after sending the re-auth link', async () => {
    mockReauth.mockResolvedValue({ kind: 'emailLinkSent' });
    await expect(deleteAccount()).resolves.toEqual({ kind: 'emailLinkSent' });
    expect(mockCall).not.toHaveBeenCalled();
    expect(consumeAccountDeleted()).toBe(false);
  });

  it('clears the device even when sign-out fails after the server deleted the Auth user', async () => {
    mockReauth.mockResolvedValue({ kind: 'done', appleAuthorizationCode: null });
    mockFirebaseSignOut.mockRejectedValueOnce(new Error('no user'));
    await deleteAccount();
    expect(mockEndDeviceSession).toHaveBeenCalledTimes(1);
  });
});

describe('export (§3.9)', () => {
  it('re-authenticates (not for deletion) before exportData', async () => {
    mockReauth.mockResolvedValue({ kind: 'done', appleAuthorizationCode: null });
    await expect(requestDataExport()).resolves.toEqual({ kind: 'done' });
    expect(mockReauth).toHaveBeenCalledWith(mockUser, { forDeletion: false });
    expect(mockCall).toHaveBeenCalledWith('exportData');
  });
});

describe('sign-out', () => {
  it("drops this device's push token first, so the next account on the phone gets none of this one's pushes", async () => {
    await signOut();
    expect(mockOrder).toEqual(['deleteToken', 'signOut', 'clearDevice']);
  });

  it('leaves FCM alone when notifications were never granted', async () => {
    mockGranted = false;
    await signOut();
    expect(mockUnregister).not.toHaveBeenCalled();
    expect(mockOrder).toEqual(['signOut', 'clearDevice']);
  });
});
