import { CHAT_MESSAGE_MAX, sendMessageInput } from '@friendpod/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import ChatScreen from '../app/pod/[podId]/chat';
import { Colors, POD_PALETTE } from '@/components/theme';

const POD_ID = 'abcdefghijklmnopqrst';
const HOUR = 3_600_000;

const mockRouter = { push: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({ podId: 'abcdefghijklmnopqrst' }),
}));
jest.mock('@/features/session/SessionProvider', () => ({ useUid: () => 'me' }));
jest.mock('@/features/pods/ScreenCaptureGuard', () => ({ ScreenCaptureGuard: () => null }));
jest.mock('@/features/photos/AuthenticatedPhoto', () => ({ AuthenticatedPhoto: () => null }));

const live = (data: unknown) => ({ data, error: null, isLoading: false });
let mockPod: Record<string, unknown> = {};
let mockMessages: unknown[] = [];
const mockCard = { state: 'scheduled', myStatus: 'accepted', themeLabel: 'Brætspil', themeSensitive: false, reasons: [] };
jest.mock('@/data/docs', () => ({
  usePodCard: () => live(mockCard),
  usePod: () => live(mockPod),
  usePodMessages: () => live(mockMessages),
}));

const mockRemember = jest.fn(async (_uid: string, _podId: string, _expiresAt: number) => undefined);
jest.mock('@/features/account/useDeviceCacheHygiene', () => ({
  rememberCachedMessages: (uid: string, podId: string, expiresAt: number) => mockRemember(uid, podId, expiresAt),
}));

const mockCall = jest.fn();
jest.mock('@/firebase/callables', () => ({
  callFunction: (...args: unknown[]) => mockCall(...args),
  toAppError: (e: unknown) => e,
}));

const ts = (ms: number) => ({ toMillis: () => ms });

/** The pod's theme (the colour comes from the card's word: "Brætspil" is Tomat). */
const THEME = { kind: 'concept', conceptId: 'seed_boardgames', sensitive: false };

/** A pod whose meetup is `fromNow` ms away (negative: in the past). */
function podWithMeetup(fromNow: number, state = 'scheduled') {
  const meetupAt = Date.now() + fromNow;
  return {
    state,
    theme: THEME,
    memberUids: ['me', 'anna', 'bo'],
    roster: { me: { firstName: 'Mia', photoV: null }, anna: { firstName: 'Anna', photoV: null }, bo: { firstName: 'Bo', photoV: null } },
    planning: { deadline: ts(meetupAt - 72 * HOUR), meetupAt: ts(meetupAt) },
  };
}

function message(id: string, authorUid: string, text: string) {
  const createdAt = Date.now() - HOUR;
  return { id, data: { authorUid, text, createdAt: ts(createdAt), expiresAt: ts(createdAt + 72 * HOUR) } };
}

let client: QueryClient;
async function renderChat() {
  // No garbage-collection timers, so nothing outlives the test.
  client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  await render(
    <QueryClientProvider client={client}>
      <ChatScreen />
    </QueryClientProvider>,
  );
}

const input = () => screen.getByLabelText('Message');
const sendButton = () => screen.getByTestId('chat-send');

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  mockCall.mockReset();
  mockRemember.mockClear();
  mockRouter.push.mockClear();
  mockPod = podWithMeetup(2 * HOUR);
  mockMessages = [];
});

afterEach(() => client.clear());

describe('meetup chat (§3.6)', () => {
  it('counts characters up to 500 and sends only non-blank text', async () => {
    await renderChat();
    expect(input()).toHaveProp('maxLength', CHAT_MESSAGE_MAX);
    // The counter stays out of the way until the limit is near.
    expect(screen.queryByText('0/500')).toBeNull();
    expect(sendButton()).toBeDisabled();

    await fireEvent.changeText(input(), '   ');
    expect(screen.queryByText('3/500')).toBeNull();
    expect(sendButton()).toBeDisabled();

    await fireEvent.changeText(input(), 'x'.repeat(400));
    expect(screen.getByText('400/500')).toBeOnTheScreen();

    await fireEvent.changeText(input(), 'x'.repeat(CHAT_MESSAGE_MAX));
    expect(screen.getByText('500/500')).toBeOnTheScreen();
    expect(screen.getByLabelText('500 of 500 characters')).toBeOnTheScreen();
    expect(sendButton()).toBeEnabled();

    mockCall.mockResolvedValueOnce({ messageId: 'm1' });
    await fireEvent.changeText(input(), '  Hej alle  ');
    await fireEvent.press(sendButton());
    await flush();
    expect(mockCall).toHaveBeenCalledWith('sendMessage', { podId: POD_ID, text: '  Hej alle  ' });
    // The shared schema trims before the request leaves the device.
    expect(sendMessageInput.parse(mockCall.mock.calls[0][1])).toEqual({ podId: POD_ID, text: 'Hej alle' });
    expect(input()).toHaveDisplayValue('');
  });

  it('holds back contact details before the meetup until "Send anyway"', async () => {
    mockCall.mockResolvedValueOnce({ warnings: ['CONTACT_INFO_BEFORE_MEETUP'] }).mockResolvedValueOnce({ messageId: 'm2' });
    await renderChat();
    await fireEvent.changeText(input(), 'Ring på 12345678');
    await fireEvent.press(sendButton());
    await flush();

    expect(mockCall).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('alert', { name: "You haven't met yet. It's fine to wait until after the meetup before sharing your number or profile." }),
    ).toBeOnTheScreen();
    expect(input()).toHaveDisplayValue('Ring på 12345678');
    // While the warning is up, only "Send anyway" sends.
    expect(sendButton()).toBeDisabled();

    await fireEvent.press(screen.getByRole('button', { name: 'Send anyway' }));
    await flush();
    expect(mockCall).toHaveBeenNthCalledWith(2, 'sendMessage', { podId: POD_ID, text: 'Ring på 12345678', ackContactWarning: true });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(input()).toHaveDisplayValue('');
  });

  it('"Edit" keeps the text and sends nothing', async () => {
    mockCall.mockResolvedValueOnce({ warnings: ['CONTACT_INFO_BEFORE_MEETUP'] });
    await renderChat();
    await fireEvent.changeText(input(), 'mia@example.com');
    await fireEvent.press(sendButton());
    await flush();
    await fireEvent.press(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(input()).toHaveDisplayValue('mia@example.com');
    expect(sendButton()).toBeEnabled();
    expect(mockCall).toHaveBeenCalledTimes(1);
  });

  it('never sends a CPR-like number', async () => {
    await renderChat();
    await fireEvent.changeText(input(), 'Mit cpr er 010190-1234');
    await fireEvent.press(sendButton());
    await flush();
    expect(mockCall).not.toHaveBeenCalled();
    expect(screen.getByText("This looks like a CPR number, so it wasn't saved. Never share CPR numbers on Friendpod.")).toBeOnTheScreen();
  });

  it('is read-only once closed, with the deletion notice', async () => {
    mockPod = podWithMeetup(-30 * HOUR, 'happened');
    mockMessages = [message('m1', 'anna', 'Tak for i dag!')];
    await renderChat();
    expect(screen.getByText('Chat closed')).toBeOnTheScreen();
    expect(screen.getByText('This chat closed 24 hours after the meetup. Messages are deleted about 3 days after it.')).toBeOnTheScreen();
    expect(screen.getByText('Tak for i dag!')).toBeOnTheScreen();
    expect(input()).toBeDisabled();
    expect(input()).toHaveProp('editable', false);
    expect(sendButton()).toBeDisabled();
  });

  it('never shows a message after its expiresAt, and has the cached copies cleared', async () => {
    mockPod = podWithMeetup(-30 * HOUR, 'happened');
    const kept = message('m1', 'anna', 'Tak for i dag!');
    const old = message('m0', 'bo', 'Fra sidste møde');
    // TTL has not deleted it yet, or it is a cached copy of a message the server deleted.
    mockMessages = [{ ...old, data: { ...old.data, expiresAt: ts(Date.now() - 1) } }, kept];
    await renderChat();
    expect(screen.getByText('Tak for i dag!')).toBeOnTheScreen();
    expect(screen.queryByText('Fra sidste møde')).toBeNull();
    expect(mockRemember).toHaveBeenCalledWith('me', POD_ID, kept.data.expiresAt.toMillis());
  });

  it('stays closed before the window, and when the meetup was moved', async () => {
    mockPod = podWithMeetup(30 * HOUR);
    await renderChat();
    expect(screen.getByText(/^Chat opens /)).toBeOnTheScreen();
    expect(input()).toBeDisabled();

    mockPod = { ...podWithMeetup(2 * HOUR, 'planning'), planning: { deadline: ts(Date.now() + 48 * HOUR) } };
    mockMessages = [message('m1', 'bo', 'Jeg er lidt forsinket')];
    await renderChat();
    expect(screen.getByText(/^This chat closed because the meetup is no longer scheduled/)).toBeOnTheScreen();
    expect(input()).toBeDisabled();
  });

  it('is text only: no quick replies and no "Can\'t make it" (D14, that is on the attendance card)', async () => {
    await renderChat();
    for (const label of ['On my way', 'Running a bit late', "I'm here", "Can't make it"]) {
      expect(screen.queryByRole('button', { name: label })).toBeNull();
      expect(screen.queryByText(label)).toBeNull();
    }
    expect(screen.queryByRole('toolbar')).toBeNull();
    expect(input()).toBeEnabled();
  });

  it('wears the pod colour in its band (from the theme word), and none in a pod about a private interest', async () => {
    await renderChat();
    expect(screen.getByTestId('chat-band')).toHaveStyle({ backgroundColor: POD_PALETTE.tomat.tint });
    client.clear();

    mockPod = { ...podWithMeetup(2 * HOUR), theme: { kind: 'concept', conceptId: 'c_9f8e7d6c5b4a39281706_p', sensitive: true } };
    mockCard.themeSensitive = true;
    try {
      await renderChat();
      expect(screen.getByTestId('chat-band')).toHaveStyle({ backgroundColor: Colors.light.privateBg, borderColor: Colors.light.privateBorder });
    } finally {
      mockCard.themeSensitive = false;
    }
  });

  it('names authors from the roster and reports others’ messages', async () => {
    mockMessages = [
      message('m1', 'anna', 'Jeg tager kage med'),
      message('m2', 'me', 'Jeg er på vej'),
      message('m3', 'gone', 'Jeg er her'),
    ];
    await renderChat();
    // "Anna · 15:02": the author line is one run of text.
    expect(screen.getByText(/^Anna · /)).toBeOnTheScreen();
    expect(screen.getByText(/^Former member · /)).toBeOnTheScreen();
    // The note above the messages: who can read them, when they go, and how to report.
    expect(screen.getByText(/^Only your pod can read this\. Messages are deleted about 3 days after the meetup\. Press and hold a message to report it\.$/)).toBeOnTheScreen();

    await fireEvent(screen.getByLabelText(/^Anna, .*: Jeg tager kage med$/), 'longPress');
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/sheets/report', params: { podId: POD_ID, messageId: 'm1' } });

    await fireEvent(screen.getByLabelText(/^Former member, .*: Jeg er her$/), 'accessibilityAction', { nativeEvent: { actionName: 'report' } });
    expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/sheets/report', params: { podId: POD_ID, messageId: 'm3' } });

    // The viewer's own messages offer no report.
    expect(screen.getByLabelText(/^You, .*: Jeg er på vej$/)).not.toHaveProp('accessibilityActions', expect.anything());
  });
});
