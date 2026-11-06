/**
 * The two bottom sheets, "Why this pod" (storyboard 2.3) and the member sheet (4.2). On the Android device they were
 * native fit-to-contents form sheets: the sheet kept the height it measured at the loading state and cut off "What we
 * never use" and "How matching works", and its fixed light grey dimming left the screen below readable where the
 * storyboards draw a dark #59615C backdrop (audit "why-sheet"). Now the root stack presents them as transparent modals
 * and SheetScreen draws the backdrop and a sheet whose height comes from layout.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { StatusBar, StyleSheet, Text } from 'react-native';
import MemberSheet from '../app/pod/[podId]/member/[uid]';
import RootLayout from '../app/_layout';
import WhyThisPod from '../app/sheets/why-this-pod';
import { SHEET_DISMISS_DISTANCE, SheetScreen } from '@/components/sheet';
import { Colors } from '@/components/theme';

const POD_ID = 'abcdefghijklmnopqrst';
const mockRouter = { push: jest.fn(), back: jest.fn() };
let mockParams: Record<string, string> = {};
/** The options each `Stack.Screen` of the root layout was given, by route name. */
const mockScreenOptions: Record<string, Record<string, unknown>> = {};
jest.mock('expo-router', () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => children;
  const Screen = ({ name, options }: { name: string; options?: Record<string, unknown> }) => {
    mockScreenOptions[name] = options ?? {};
    return null;
  };
  return {
    Stack: Object.assign(Pass, { Screen, Protected: Pass }),
    ThemeProvider: Pass,
    useRouter: () => mockRouter,
    useLocalSearchParams: () => mockParams,
  };
});
jest.mock('@/firebase', () => ({ initFirebase: () => undefined }));
jest.mock('@/firebase/callables', () => ({ callFunction: jest.fn(), toAppError: (e: unknown) => e }));
jest.mock('@/features/session/SessionProvider', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({ phase: 'ready', user: { uid: 'me' } }),
  useUid: () => 'me',
}));
jest.mock('@/features/account/useDeviceCacheHygiene', () => ({ useDeviceCacheHygiene: () => undefined }));
jest.mock('@/features/notifications/useNotificationRouting', () => ({ useNotificationRouting: () => undefined }));
jest.mock('@/features/notifications/usePushTokenSync', () => ({ usePushTokenSync: () => undefined }));
jest.mock('@/features/session/useAppOpened', () => ({ useAppOpened: () => undefined }));
jest.mock('@/features/photos/AuthenticatedPhoto', () => ({ AuthenticatedPhoto: () => null }));
jest.mock('@/features/account/clearDeviceData', () => ({ clearImageCaches: async () => undefined }));

const live = (data: unknown) => ({ data, error: null, isLoading: false });
let mockCard: unknown = null;
jest.mock('@/data/docs', () => ({
  useUserDoc: () => live(undefined),
  usePodCard: () => live(mockCard),
  usePod: () => live({ state: 'planning', memberUids: ['me', 'anna'], roster: { me: { firstName: 'Mia', photoV: null }, anna: { firstName: 'Anna', photoV: null } } }),
  useBlocks: () => live([]),
}));

const card = {
  state: 'proposed',
  myStatus: 'invited',
  themeLabel: 'brætspil',
  themeSensitive: false,
  reasons: [
    { code: 'THEME', yourWording: 'brætspil' },
    { code: 'ALSO_SHARE', yourWordings: ['sourdough', 'trail running'] },
    { code: 'NEAR_YOU', km: 10 },
    { code: 'AREA', label: 'Aarhus C' },
    { code: 'AGE_SPAN', min: 29, max: 38 },
    { code: 'PRIORITY', weeks: 2 },
  ],
};

let client: QueryClient | undefined;
async function renderWith(ui: ReactElement) {
  client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: Infinity } } });
  await render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}
beforeEach(() => {
  mockRouter.push.mockClear();
  mockRouter.back.mockClear();
  mockParams = { podId: POD_ID, uid: 'anna' };
  mockCard = card;
});
afterEach(() => client?.clear());

const style = (el: { props: { style?: unknown } }) => StyleSheet.flatten(el.props.style as never) ?? {};
/** The backdrop: hidden from screen readers next to the modal sheet (`accessibilityViewIsModal`), so query it as such. */
const backdropEl = () => screen.getByTestId('sheet-backdrop', { includeHiddenElements: true });

/** A one-finger move from `fromY` to `toY` between two timestamps, as the responder system reports it. */
function move(fromY: number, toY: number, fromT: number, toT: number) {
  const touch = {
    touchActive: true,
    startPageX: 200,
    startPageY: fromY,
    startTimeStamp: fromT,
    currentPageX: 200,
    currentPageY: toY,
    currentTimeStamp: toT,
    previousPageX: 200,
    previousPageY: fromY,
    previousTimeStamp: fromT,
  };
  return {
    nativeEvent: { touches: [{ pageX: 200, pageY: toY }] },
    touchHistory: { numberActiveTouches: 1, indexOfSingleActiveTouch: 0, mostRecentTimeStamp: toT, touchBank: [touch] },
  };
}

/**
 * Drags the sheet down by `dy` points as the responder system does: the touch starts, its first move past the slop
 * asks the sheet (capture, then bubble) whether it takes the gesture, then it moves on and is let go.
 */
async function dragSheet(dy: number, ms: number) {
  const sheet = screen.getByTestId('sheet');
  await act(async () => {
    sheet.props.onStartShouldSetResponderCapture(move(100, 100, 0, 0));
    const start = move(100, 120, 0, 16);
    sheet.props.onMoveShouldSetResponderCapture(start);
    expect(sheet.props.onMoveShouldSetResponder(start)).toBe(true);
    sheet.props.onResponderGrant(start);
    const end = move(120, 120 + dy, 16, 16 + ms);
    sheet.props.onResponderMove(end);
    sheet.props.onResponderRelease(end);
  });
}

describe('the root stack presents both sheets', () => {
  it('as transparent modals that fade in, never as a native fit-to-contents form sheet', async () => {
    await renderWith(<RootLayout />);
    for (const name of ['sheets/why-this-pod', 'pod/[podId]/member/[uid]']) {
      expect(mockScreenOptions[name]).toMatchObject({ presentation: 'transparentModal', animation: 'fade', headerShown: false });
      expect(mockScreenOptions[name]).not.toHaveProperty('sheetAllowedDetents');
    }
    // The report sheet stays a full modal.
    expect(mockScreenOptions['sheets/report']).toMatchObject({ presentation: 'modal' });
  });
});

describe('SheetScreen', () => {
  it("draws the storyboards' dark backdrop, which closes the sheet on a tap, with light status-bar icons", async () => {
    const push = jest.spyOn(StatusBar, 'pushStackEntry');
    const onClose = jest.fn();
    await renderWith(
      <SheetScreen onClose={onClose}>
        <Text>Body</Text>
      </SheetScreen>,
    );
    const backdrop = backdropEl();
    expect(style(backdrop)).toMatchObject({ backgroundColor: Colors.light.sheetBackdrop, position: 'absolute', top: 0, bottom: 0 });
    // Not something to focus: the sheet has its own Close button.
    expect(backdrop.props.accessible).toBe(false);
    expect(screen.queryByTestId('sheet-backdrop')).toBeNull();
    expect(push).toHaveBeenCalledWith(expect.objectContaining({ barStyle: 'light-content' }));
    await fireEvent.press(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
    push.mockRestore();
  });

  it('is as tall as its content, bottom-aligned, and may shrink below the status bar', async () => {
    await renderWith(
      <SheetScreen onClose={jest.fn()}>
        <Text>Body</Text>
      </SheetScreen>,
    );
    const sheet = screen.getByTestId('sheet');
    expect(style(sheet)).toMatchObject({ flexShrink: 1 });
    expect(style(sheet)).not.toHaveProperty('height');
    expect(style(sheet.parent as never)).toMatchObject({ flex: 1, justifyContent: 'flex-end' });
  });

  it('closes on a drag down past the threshold, and settles back after a short one', async () => {
    const onClose = jest.fn();
    await renderWith(
      <SheetScreen onClose={onClose}>
        <Text>Body</Text>
      </SheetScreen>,
    );
    await dragSheet(SHEET_DISMISS_DISTANCE / 2, 600);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(onClose).not.toHaveBeenCalled();

    await dragSheet(SHEET_DISMISS_DISTANCE + 40, 300);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});

describe('Why this pod (2.3)', () => {
  it('shows every block of the storyboard over the dark backdrop, which closes it on a tap', async () => {
    await renderWith(<WhyThisPod />);
    expect(screen.getByText('Everyone added brætspil, or something that means the same.')).toBeOnTheScreen();
    expect(screen.getByText('You waited 2 weeks, so you got priority this time.')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'What we never use' })).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'How matching works' })).toBeOnTheScreen();
    expect(style(backdropEl())).toMatchObject({ backgroundColor: Colors.light.sheetBackdrop });
    await fireEvent.press(backdropEl());
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it("keeps its surface at its content's height, shrinking and scrolling only when the screen is too short", async () => {
    await renderWith(<WhyThisPod />);
    const surface = screen.getByTestId('sheet').children[0] as unknown as { props: { style?: unknown } };
    expect(style(surface)).toMatchObject({ flexShrink: 1, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 32 });
    // No percentage cap or fixed height: the height follows the content as it loads.
    expect(style(surface)).not.toHaveProperty('maxHeight');
    expect(style(surface)).not.toHaveProperty('height');
  });
});

describe('member sheet (4.2)', () => {
  it('sits over the same dark backdrop, which closes it on a tap', async () => {
    await renderWith(<MemberSheet />);
    expect(screen.getByRole('button', { name: 'Block Anna' })).toBeOnTheScreen();
    expect(style(backdropEl())).toMatchObject({ backgroundColor: Colors.light.sheetBackdrop });
    await fireEvent.press(backdropEl());
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });
});
