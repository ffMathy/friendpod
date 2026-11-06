import { registerPushTokenInput } from '@grouper/core';
import { act, render } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { registerPushToken } from '@/features/notifications/push';
import { openPushRoute, routeForPush, tabForRoute, PUSH_KINDS, type CardRow } from '@/features/notifications/routing';
import { resetInitialNotificationForTests, useNotificationRouting } from '@/features/notifications/useNotificationRouting';
import { usePushTokenSync } from '@/features/notifications/usePushTokenSync';

type Listener = (value: unknown) => void;
const mockMessaging = {
  status: 1,
  token: 'fcm-token-1',
  refresh: null as Listener | null,
  opened: null as Listener | null,
  initial: null as unknown,
  registerDevice: jest.fn(async () => undefined),
};
jest.mock('@react-native-firebase/messaging', () => ({
  AuthorizationStatus: { AUTHORIZED: 1, PROVISIONAL: 2, DENIED: 0 },
  hasPermission: async () => mockMessaging.status,
  requestPermission: async () => mockMessaging.status,
  getToken: async () => mockMessaging.token,
  deleteToken: async () => undefined,
  registerDeviceForRemoteMessages: () => mockMessaging.registerDevice(),
  onTokenRefresh: (_m: unknown, l: Listener) => {
    mockMessaging.refresh = l;
    return () => {
      mockMessaging.refresh = null;
    };
  },
  onNotificationOpenedApp: (_m: unknown, l: Listener) => {
    mockMessaging.opened = l;
    return () => {
      mockMessaging.opened = null;
    };
  },
  getInitialNotification: async () => mockMessaging.initial,
}));
jest.mock('@/firebase', () => ({ messaging: () => ({}) }));

const mockCall = jest.fn(async () => ({ ok: true }));
jest.mock('@/firebase/callables', () => ({ callFunction: (...a: unknown[]) => mockCall(...(a as [])) }));

const mockRouter = { navigate: jest.fn(), dismissTo: jest.fn() };
// Where the user is when the push is tapped (`useSegments`): This week by default.
let mockSegments: string[] = ['(tabs)'];
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useSegments: () => mockSegments }));
let mockCards: CardRow[] | undefined = [];
jest.mock('@/data/docs', () => ({ usePodCards: () => ({ data: mockCards, error: null, isLoading: mockCards === undefined }) }));

const flush = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

const originalOS = Platform.OS;
beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockMessaging, { status: 1, token: 'fcm-token-1', refresh: null, opened: null, initial: null });
  mockCards = [];
  mockSegments = ['(tabs)'];
  resetInitialNotificationForTests();
  Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
});
afterAll(() => Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true }));

describe('push token (A14)', () => {
  it('registers the APNs-backed FCM token on iOS through registerPushToken', async () => {
    await registerPushToken();
    expect(mockMessaging.registerDevice).toHaveBeenCalled();
    expect(mockCall).toHaveBeenCalledWith('registerPushToken', { token: 'fcm-token-1', platform: 'ios' });
    expect(registerPushTokenInput.safeParse({ token: 'fcm-token-1', platform: 'ios' }).success).toBe(true);
  });

  it('on sign-in with notifications granted: registers, then re-registers each refreshed token', async () => {
    function Harness() {
      usePushTokenSync();
      return null;
    }
    const view = await render(<Harness />);
    await flush();
    expect(mockCall).toHaveBeenCalledWith('registerPushToken', { token: 'fcm-token-1', platform: 'ios' });
    expect(mockMessaging.refresh).not.toBeNull();
    mockMessaging.refresh?.('fcm-token-2');
    expect(mockCall).toHaveBeenLastCalledWith('registerPushToken', { token: 'fcm-token-2', platform: 'ios' });
    await view.unmount();
    expect(mockMessaging.refresh).toBeNull();
  });

  it('does nothing until the user has granted notifications', async () => {
    mockMessaging.status = 0;
    function Harness() {
      usePushTokenSync();
      return null;
    }
    await render(<Harness />);
    await flush();
    expect(mockCall).not.toHaveBeenCalled();
    expect(mockMessaging.refresh).toBeNull();
  });
});

describe('notification taps (S4: the payload is only data.kind)', () => {
  const card = (id: string, state: string, myStatus = 'accepted'): CardRow => ({ id, data: { state, myStatus } as CardRow['data'] });

  it('maps every kind to a screen', () => {
    for (const kind of PUSH_KINDS) expect(routeForPush(kind, [])).toBeTruthy();
    expect(routeForPush('dropReady', [])).toBe('/');
    expect(routeForPush('weeklyNudge', [])).toBe('/');
    expect(routeForPush('areaOpen', [])).toBe('/');
    expect(routeForPush('notice', [])).toBe('/settings/notices');
  });

  it('opens the one pod the push can be about, its chat for chat pushes, else the Pods tab', () => {
    const one = [card('p1', 'scheduled'), card('p2', 'archived'), card('p3', 'scheduled', 'declined')];
    expect(routeForPush('stillComing', one)).toEqual({ pathname: '/pod/[podId]', params: { podId: 'p1' } });
    expect(routeForPush('chatMessage', one)).toEqual({ pathname: '/pod/[podId]/chat', params: { podId: 'p1' } });
    expect(routeForPush('feedback', [card('p4', 'happened')])).toEqual({ pathname: '/pod/[podId]', params: { podId: 'p4' } });
    expect(routeForPush('podConfirmed', [card('p5', 'planning'), card('p6', 'planning')])).toBe('/pods');
    expect(routeForPush('feedback', one)).toBe('/pods');
  });

  it('knows which destinations are pages of a tab and which open over the tabs', () => {
    expect(tabForRoute('/')).toBe('index');
    expect(tabForRoute('/pods')).toBe('(pods)');
    expect(tabForRoute({ pathname: '/pod/[podId]', params: { podId: 'p1' } })).toBe('(pods)');
    expect(tabForRoute({ pathname: '/pod/[podId]/chat', params: { podId: 'p1' } })).toBeNull();
    expect(tabForRoute('/settings/notices')).toBeNull();
  });

  it('shows a pod in the Pods tab without a second copy of the tabs, wherever the user is', () => {
    const pod = { pathname: '/pod/[podId]', params: { podId: 'p1' } } as const;
    const router = { navigate: jest.fn(), dismissTo: jest.fn() };
    // From another tab: a switch of tabs, with the Pods list underneath.
    openPushRoute(router, pod, ['(tabs)', '(me)', 'me']);
    expect(router.navigate).toHaveBeenLastCalledWith(pod, { withAnchor: true });
    // From a screen over the tabs (a chat, Settings): it is dismissed.
    openPushRoute(router, pod, ['pod', '[podId]', 'chat']);
    expect(router.dismissTo).toHaveBeenLastCalledWith(pod, { withAnchor: true });
    // Within the Pods tab: whatever is above the list makes way.
    openPushRoute(router, '/pods', ['(tabs)', '(pods)', 'pod', '[podId]']);
    expect(router.dismissTo).toHaveBeenLastCalledWith('/pods', { withAnchor: true });
    // This week is named by its group ("/" is also sign-in's start).
    openPushRoute(router, '/', ['settings', 'notices']);
    expect(router.dismissTo).toHaveBeenLastCalledWith('/(tabs)', { withAnchor: true });
    openPushRoute(router, '/', ['(tabs)', 'interests']);
    expect(router.navigate).toHaveBeenLastCalledWith('/(tabs)', { withAnchor: true });
    // The chat and the notices open over the tabs.
    openPushRoute(router, '/settings/notices', ['(tabs)']);
    expect(router.navigate).toHaveBeenLastCalledWith('/settings/notices');
    expect(router.navigate).toHaveBeenCalledTimes(3);
    expect(router.dismissTo).toHaveBeenCalledTimes(3);
  });

  function Harness() {
    useNotificationRouting('me');
    return null;
  }

  it('routes the push that cold-started the app, once per process', async () => {
    mockCards = [{ id: 'p1', data: { state: 'scheduled', myStatus: 'accepted' } as CardRow['data'] }];
    mockMessaging.initial = { data: { kind: 'chatOpen' } };
    const view = await render(<Harness />);
    await flush();
    expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/pod/[podId]/chat', params: { podId: 'p1' } });
    await view.unmount();
    await render(<Harness />);
    await flush();
    expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
    expect(mockRouter.dismissTo).not.toHaveBeenCalled();
  });

  it('routes a tap from the background, waiting for the pod cards', async () => {
    mockCards = undefined;
    const view = await render(<Harness />);
    await flush();
    await act(async () => {
      mockMessaging.opened?.({ data: { kind: 'feedback' } });
    });
    expect(mockRouter.navigate).not.toHaveBeenCalled();
    expect(mockRouter.dismissTo).not.toHaveBeenCalled();
    mockCards = [{ id: 'p9', data: { state: 'happened', myStatus: 'accepted' } as CardRow['data'] }];
    await view.rerender(<Harness />);
    await flush();
    // From This week, the pod opens in the Pods tab.
    expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/pod/[podId]', params: { podId: 'p9' } }, { withAnchor: true });
    expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
  });

  it('routes a tap over the tabs into the Pods tab by dismissing what is open', async () => {
    mockSegments = ['settings', 'notices'];
    mockCards = [{ id: 'p9', data: { state: 'scheduled', myStatus: 'accepted' } as CardRow['data'] }];
    await render(<Harness />);
    await flush();
    await act(async () => {
      mockMessaging.opened?.({ data: { kind: 'meetupReminder' } });
    });
    await flush();
    expect(mockRouter.dismissTo).toHaveBeenCalledWith({ pathname: '/pod/[podId]', params: { podId: 'p9' } }, { withAnchor: true });
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });

  it('ignores a push without a known kind', async () => {
    await render(<Harness />);
    await flush();
    await act(async () => {
      mockMessaging.opened?.({ data: { kind: 'somethingElse' } });
      mockMessaging.opened?.({});
    });
    expect(mockRouter.navigate).not.toHaveBeenCalled();
    expect(mockRouter.dismissTo).not.toHaveBeenCalled();
  });
});
