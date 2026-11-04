import { act, renderHook } from '@testing-library/react-native';
import { useChatMessages } from '@/features/chat/useChatMessages';

const T = Date.UTC(2026, 10, 15, 17, 0);
const POD_ID = 'abcdefghijklmnopqrst';

const ts = (ms: number) => ({ toMillis: () => ms });
const row = (id: string, expiresAt: number) => ({
  id,
  data: { authorUid: 'anna', kind: 'quickReply', quickReply: 'imHere', createdAt: ts(T - 70 * 3_600_000), expiresAt: ts(expiresAt) },
});

let mockRows: unknown[] = [];
jest.mock('@/data/docs', () => ({ usePodMessages: () => ({ data: mockRows, error: null, isLoading: false }) }));
const mockRemember = jest.fn(async (_uid: string, _podId: string, _expiresAt: number) => undefined);
jest.mock('@/features/account/useDeviceCacheHygiene', () => ({
  rememberCachedMessages: (uid: string, podId: string, expiresAt: number) => mockRemember(uid, podId, expiresAt),
}));

beforeEach(() => jest.useFakeTimers({ now: T }));
afterEach(() => jest.useRealTimers());

describe('useChatMessages (§3.6, PRIVACY.md §5)', () => {
  it('drops each message at its expiresAt and records the latest expiry for cache hygiene', async () => {
    mockRows = [row('expired', T - 1), row('soon', T + 1000), row('later', T + 5000)];
    const { result } = await renderHook(() => useChatMessages('me', POD_ID, true));
    expect(result.current.data?.map((r) => r.id)).toEqual(['soon', 'later']);
    expect(mockRemember).toHaveBeenCalledWith('me', POD_ID, T + 5000);

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current.data?.map((r) => r.id)).toEqual(['later']);
    await act(async () => {
      jest.advanceTimersByTime(4000);
    });
    expect(result.current.data).toEqual([]);
  });
});
