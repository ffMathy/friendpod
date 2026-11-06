/**
 * The route tree as the app ships it: every file under app/ (screens stubbed, the real root, tab, Pods, Me, Settings and
 * info layouts) in Expo Router's in-memory test router. The pod page (storyboards 3.1, 3.4) and Privacy (5.3) are pages
 * of their tab's stack, so the tab bar stays, while their URLs (used by push routing, +native-intent and links) stay
 * as they were; the pod's planner, chat, feedback and member sheet, the rest of Settings and the sheets open over the
 * tabs. Links into a tab from over the tabs never stack a second copy of the tabs.
 */
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { router, Stack } from 'expo-router';
import { act, renderRouter, screen, type RenderRouterResult } from 'expo-router/testing-library';
import type { ComponentType } from 'react';
import { Text } from 'react-native';
import { openPushRoute } from '@/features/notifications/routing';
import * as MeLayout from '../app/(tabs)/(me)/_layout';
import * as PodsLayout from '../app/(tabs)/(pods)/_layout';
import * as TabsLayout from '../app/(tabs)/_layout';
import * as RootLayout from '../app/_layout';
import * as InfoLayout from '../app/info/_layout';
import * as SettingsLayout from '../app/settings/_layout';

jest.mock('@/firebase', () => ({ initFirebase: () => undefined }));
jest.mock('@/features/session/SessionProvider', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({ phase: 'ready', user: { uid: 'me' } }),
  useUid: () => 'me',
}));
jest.mock('@/data/docs', () => ({ useUserDoc: () => ({ data: undefined, error: null, isLoading: false }) }));
jest.mock('@/features/account/useDeviceCacheHygiene', () => ({ useDeviceCacheHygiene: () => undefined }));
jest.mock('@/features/notifications/useNotificationRouting', () => ({ useNotificationRouting: () => undefined }));
jest.mock('@/features/notifications/usePushTokenSync', () => ({ usePushTokenSync: () => undefined }));
jest.mock('@/features/session/useAppOpened', () => ({ useAppOpened: () => undefined }));

const APP = join(__dirname, '..', 'app');

/** Layouts used as they are; every other file is a stub screen that shows its route. */
const LAYOUTS: Record<string, object> = {
  _layout: RootLayout,
  '(tabs)/_layout': TabsLayout,
  '(tabs)/(pods)/_layout': PodsLayout,
  '(tabs)/(me)/_layout': MeLayout,
  'settings/_layout': SettingsLayout,
  'info/_layout': InfoLayout,
  // Shut out by the root's guards once the session is ready; plain stacks stand in for them.
  '(auth)/_layout': { default: () => <Stack /> },
  '(onboarding)/_layout': { default: () => <Stack /> },
};

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(dir, entry.name)) : /\.tsx?$/.test(entry.name) ? [join(dir, entry.name)] : [],
  );
}

function appTree(): Record<string, unknown> {
  const tree: Record<string, unknown> = {};
  for (const file of files(APP)) {
    const key = relative(APP, file).replace(/\.tsx?$/, '');
    if (key === '+native-intent') continue;
    const layout = LAYOUTS[key];
    if (layout) tree[key] = layout;
    else if (key.endsWith('_layout')) throw new Error(`New layout ${key}: add it to LAYOUTS`);
    else {
      const Stub: ComponentType = () => <Text>{`screen:${key}`}</Text>;
      tree[key] = Stub;
    }
  }
  return tree;
}

interface NavState {
  readonly index?: number;
  readonly routes: readonly { name: string; params?: object; state?: NavState }[];
}

/** The route names of each focused navigator, root first: e.g. ['__root', '(tabs)', '(pods)', 'pod/[podId]']. */
function focusedPath(state: NavState | undefined): string[] {
  if (!state) return [];
  const route = state.routes[state.index ?? state.routes.length - 1]!;
  return [route.name, ...focusedPath(route.state)];
}

/** The routes of the navigator `depth` levels down the focused path (0 = the root layout's stack). */
function stackAt(r: RenderRouterResult, depth: number): string[] {
  let state = r.getRouterState() as NavState | undefined;
  // The router state's root is the __root route; its state is the root layout's stack.
  state = state?.routes[state.index ?? 0]?.state;
  for (let i = 0; i < depth && state; i++) state = state.routes[state.index ?? state.routes.length - 1]!.state;
  return state ? state.routes.map((route) => route.name) : [];
}

const render = (initialUrl: string) => renderRouter(appTree() as never, { initialUrl });

describe('the pod page and Privacy keep the tab bar, at their old URLs', () => {
  it.each([
    ['/pod/abc', ['(tabs)', '(pods)', 'pod/[podId]'], ['pods', 'pod/[podId]']],
    ['/pods', ['(tabs)', '(pods)', 'pods'], ['pods']],
    ['/settings/privacy', ['(tabs)', '(me)', 'settings/privacy'], ['me', 'settings/privacy']],
    ['/me', ['(tabs)', '(me)', 'me'], ['me']],
  ])('%s opens in its tab, with the tab first page underneath', async (url, path, tabStack) => {
    const r = await render(url);
    expect(r.getPathname()).toBe(url);
    expect(focusedPath(r.getRouterState() as NavState).slice(1)).toEqual(path);
    expect(stackAt(r, 0)).toEqual(['(tabs)']);
    expect(stackAt(r, 2)).toEqual(tabStack);
    // The tab bar is drawn under the page.
    expect(screen.getByRole('button', { name: /This week/ })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /Pods/ })).toBeOnTheScreen();
  });

  it.each([
    ['/pod/abc/plan', 'pod/[podId]/plan'],
    ['/pod/abc/chat', 'pod/[podId]/chat'],
    ['/pod/abc/feedback', 'pod/[podId]/feedback'],
    ['/pod/abc/member/anna', 'pod/[podId]/member/[uid]'],
    ['/sheets/why-this-pod?podId=abc', 'sheets/why-this-pod'],
    ['/sheets/report?podId=abc', 'sheets/report'],
    ['/settings', 'settings'],
    ['/settings/delete-account', 'settings'],
    ['/settings/blocked', 'settings'],
    ['/settings/notices', 'settings'],
  ])('%s opens over the tabs', async (url, route) => {
    const r = await render(url);
    expect(r.getPathnameWithParams()).toBe(url);
    expect(focusedPath(r.getRouterState() as NavState)[1]).toBe(route);
  });
});

describe('moving between the tabs and the screens over them', () => {
  it('a pod row on This week opens the pod in the Pods tab; its planner opens over the tabs and back returns to it', async () => {
    const r = await render('/');
    await act(() => router.push({ pathname: '/pod/[podId]', params: { podId: 'abc' } }, { withAnchor: true }));
    expect(r.getPathname()).toBe('/pod/abc');
    expect(stackAt(r, 2)).toEqual(['pods', 'pod/[podId]']);
    expect(screen.getByText('screen:(tabs)/(pods)/pod/[podId]')).toBeOnTheScreen();

    await act(() => router.push({ pathname: '/pod/[podId]/plan', params: { podId: 'abc' } }));
    expect(stackAt(r, 0)).toEqual(['(tabs)', 'pod/[podId]/plan']);
    await act(() => router.back());
    expect(r.getPathname()).toBe('/pod/abc');

    await act(() => router.push({ pathname: '/pod/[podId]/member/[uid]', params: { podId: 'abc', uid: 'anna' } }));
    expect(stackAt(r, 0)).toEqual(['(tabs)', 'pod/[podId]/member/[uid]']);
    await act(() => router.back());

    // Back from the pod page leads to the Pods list.
    await act(() => router.back());
    expect(r.getPathname()).toBe('/pods');
  });

  it('the Pods tab is back on its list after another tab was chosen', async () => {
    const r = await render('/pod/abc');
    await act(() => router.navigate('/'));
    await act(async () => {
      jest.runAllTimers();
    });
    expect(stackAt(r, 1)).toContain('(pods)');
    await act(() => router.push({ pathname: '/pod/[podId]', params: { podId: 'xyz' } }, { withAnchor: true }));
    expect(stackAt(r, 2)).toEqual(['pods', 'pod/[podId]']);
    expect(r.getPathname()).toBe('/pod/xyz');
  });

  it('Me → Privacy stays in the Me tab; its sub-pages open over the tabs and back returns to it', async () => {
    const r = await render('/me');
    await act(() => router.push('/settings/privacy'));
    expect(stackAt(r, 2)).toEqual(['me', 'settings/privacy']);
    await act(() => router.push('/settings/delete-account'));
    expect(stackAt(r, 0)).toEqual(['(tabs)', 'settings']);
    await act(() => router.back());
    expect(r.getPathname()).toBe('/settings/privacy');
  });

  it.each([
    ['/settings/blocked', '/settings/privacy', ['me', 'settings/privacy']],
    ['/settings/notices', '/me', ['me']],
  ])('back from %s opened at launch (useBack) lands on %s in its tab, with the tab first page underneath', async (url, fallback, tabStack) => {
    const r = await render(url);
    await act(() => router.replace(fallback as '/me', { withAnchor: true }));
    expect(stackAt(r, 0)).toEqual(['(tabs)']);
    expect(stackAt(r, 2)).toEqual(tabStack);
    expect(r.getPathname()).toBe(fallback);
  });

  it('Settings → Privacy closes Settings and shows Privacy in the Me tab', async () => {
    const r = await render('/me');
    await act(() => router.push('/settings'));
    await act(() => router.dismissTo('/settings/privacy', { withAnchor: true }));
    expect(stackAt(r, 0)).toEqual(['(tabs)']);
    expect(stackAt(r, 2)).toEqual(['me', 'settings/privacy']);
  });

  it('a push opens its pod in the Pods tab from over the tabs, from another tab and from the same tab', async () => {
    const r = await render('/settings/notices');
    const segments = () => r.getSegments();
    await act(() => openPushRoute(router, { pathname: '/pod/[podId]', params: { podId: 'abc' } }, segments()));
    expect(stackAt(r, 0)).toEqual(['(tabs)']);
    expect(stackAt(r, 2)).toEqual(['pods', 'pod/[podId]']);
    expect(r.getPathname()).toBe('/pod/abc');

    await act(() => openPushRoute(router, { pathname: '/pod/[podId]', params: { podId: 'xyz' } }, segments()));
    expect(stackAt(r, 2)).toEqual(['pods', 'pod/[podId]']);
    expect(r.getPathname()).toBe('/pod/xyz');

    await act(() => openPushRoute(router, '/pods', segments()));
    expect(stackAt(r, 2)).toEqual(['pods']);

    await act(() => router.navigate('/me'));
    await act(() => openPushRoute(router, { pathname: '/pod/[podId]', params: { podId: 'abc' } }, segments()));
    expect(stackAt(r, 0)).toEqual(['(tabs)']);
    expect(r.getPathname()).toBe('/pod/abc');

    await act(() => openPushRoute(router, { pathname: '/pod/[podId]/chat', params: { podId: 'abc' } }, segments()));
    expect(stackAt(r, 0)).toEqual(['(tabs)', 'pod/[podId]/chat']);
    // The same chat again is not stacked twice.
    await act(() => openPushRoute(router, { pathname: '/pod/[podId]/chat', params: { podId: 'abc' } }, segments()));
    expect(stackAt(r, 0)).toEqual(['(tabs)', 'pod/[podId]/chat']);

    await act(() => openPushRoute(router, '/', segments()));
    expect(stackAt(r, 0)).toEqual(['(tabs)']);
    expect(r.getPathname()).toBe('/');

    await act(() => router.navigate('/me'));
    await act(() => openPushRoute(router, '/', segments()));
    expect(r.getPathname()).toBe('/');
    await act(() => openPushRoute(router, '/', segments()));
    expect(stackAt(r, 0)).toEqual(['(tabs)']);
    expect(r.getPathname()).toBe('/');
  });
});
