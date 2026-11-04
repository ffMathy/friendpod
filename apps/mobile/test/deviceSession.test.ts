import { endDeviceSession, syncDeviceSession } from '@/features/account/deviceSession';
import { forgetPods } from '@/features/account/useDeviceCacheHygiene';
import { queryClient } from '@/data/queryClient';
import { isOnboardingComplete, setOnboardingComplete } from '@/features/session/onboardingFlag';

const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (k: string) => mockStore.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => void mockStore.set(k, v),
  deleteItemAsync: async (k: string) => void mockStore.delete(k),
}));

const mockClearDeviceData = jest.fn(async () => undefined);
const mockClearFirestoreCache = jest.fn(async () => undefined);
const mockClearImageCaches = jest.fn(async () => undefined);
jest.mock('@/features/account/clearDeviceData', () => ({
  clearDeviceData: () => mockClearDeviceData(),
  clearFirestoreCache: () => mockClearFirestoreCache(),
  clearImageCaches: () => mockClearImageCaches(),
}));
jest.mock('@/data/docs', () => ({ usePodCards: jest.fn() }));

beforeEach(() => {
  mockStore.clear();
  jest.clearAllMocks();
});

// Cached queries hold garbage-collection timers that would keep Jest from exiting.
afterAll(() => queryClient.clear());

describe('device data when a session ends (§9, PRIVACY.md §5)', () => {
  it('clears the device when the SDK signs the user out on its own (deleted elsewhere, token revoked)', async () => {
    await syncDeviceSession('uidA');
    await setOnboardingComplete('uidA');
    mockStore.set('activePods.uidA', '["pod1"]');
    await syncDeviceSession('uidA'); // token refresh: nothing happens
    expect(mockClearDeviceData).not.toHaveBeenCalled();

    // onIdTokenChanged(null), e.g. at the next start after the account was deleted on another device.
    await syncDeviceSession(null);
    expect(mockClearDeviceData).toHaveBeenCalledTimes(1);
    await expect(isOnboardingComplete('uidA')).resolves.toBe(false);
    expect([...mockStore.keys()]).toEqual([]);

    // Later starts while signed out do not clear again.
    await syncDeviceSession(null);
    expect(mockClearDeviceData).toHaveBeenCalledTimes(1);
  });

  it('clears the previous account before another one is used on the device', async () => {
    await syncDeviceSession('uidA');
    await syncDeviceSession('uidB');
    expect(mockClearDeviceData).toHaveBeenCalledTimes(1);
    expect(mockStore.get('session.lastUid')).toBe('uidB');
  });

  it("shares one run between the app's own sign-out and the auth listener", async () => {
    await syncDeviceSession('uidA');
    await Promise.all([endDeviceSession(), syncDeviceSession(null)]);
    expect(mockClearDeviceData).toHaveBeenCalledTimes(1);
  });
});

describe('a pod leaving the active list (PRIVACY.md §3.5 step 8)', () => {
  it('clears the photos, the Firestore cache and the in-memory copies of that pod only', async () => {
    queryClient.setQueryData(['doc', 'pods/podGone'], { roster: ['Ada'] });
    queryClient.setQueryData(['collection', 'pods/podGone/options'], []);
    queryClient.setQueryData(['doc', 'pods/podKept'], { roster: ['Bo'] });
    await forgetPods(['podGone']);
    expect(mockClearImageCaches).toHaveBeenCalledTimes(1);
    expect(mockClearFirestoreCache).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(['doc', 'pods/podGone'])).toBeUndefined();
    expect(queryClient.getQueryData(['collection', 'pods/podGone/options'])).toBeUndefined();
    expect(queryClient.getQueryData(['doc', 'pods/podKept'])).toEqual({ roster: ['Bo'] });
  });
});
