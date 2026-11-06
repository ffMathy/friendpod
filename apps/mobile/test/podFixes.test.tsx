import { DAY_MS, googleMapsPlaceUrl, toLocal, type Place } from '@grouper/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { usePalette } from '@/components/theme';
import { Composer } from '@/features/chat/Composer';
import { validateOptionForm } from '@/features/pods/optionForm';
import { placeArea, PlanOptionCard } from '@/features/pods/PlanOptionCard';
import ChatScreen from '../app/pod/[podId]/chat';
import PodScreen from '../app/(tabs)/(pods)/pod/[podId]';

const POD_ID = 'abcdefghijklmnopqrst';
const HOUR = 3_600_000;

const mockRouter = { push: jest.fn(), back: jest.fn(), dismissTo: jest.fn(), canGoBack: () => true, replace: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({ podId: 'abcdefghijklmnopqrst' }) }));
jest.mock('expo-calendar/legacy', () => ({ createEventInCalendarAsync: jest.fn(async () => ({ action: 'saved' })) }));
jest.mock('@/features/session/SessionProvider', () => ({ useUid: () => 'me' }));
jest.mock('@/features/pods/ScreenCaptureGuard', () => ({ ScreenCaptureGuard: () => null }));
jest.mock('@/features/photos/AuthenticatedPhoto', () => ({ AuthenticatedPhoto: () => null }));
jest.mock('@/features/account/useDeviceCacheHygiene', () => ({ rememberCachedMessages: async () => undefined }));

const mockStore: Record<string, string> = {};
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => mockStore[key] ?? null,
  setItemAsync: async (key: string, value: string) => {
    mockStore[key] = value;
  },
  deleteItemAsync: async (key: string) => {
    delete mockStore[key];
  },
}));

const live = (data: unknown) => ({ data, error: null, isLoading: false });
let mockCard: Record<string, unknown> = {};
let mockPod: Record<string, unknown> = {};
let mockMessages: unknown[] = [];
jest.mock('@/data/docs', () => ({
  usePodCard: () => live(mockCard),
  usePod: () => live(mockPod),
  usePodOptions: () => live([]),
  usePodMessages: () => live(mockMessages),
  useUserDoc: () => live({ area: { areaId: 'vejle' } }),
  useAreaDoc: () => live(null),
}));
jest.mock('@/firebase/callables', () => ({ callFunction: jest.fn(), toAppError: (e: unknown) => e }));

const ts = (ms: number) => ({ toMillis: () => ms });
/** The form's verdict for a time two days from now, with no place picked yet. */
function validateOptionFormTimes(time: string) {
  const d = toLocal(Date.now() + 2 * DAY_MS);
  const date = `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
  const v = validateOptionForm({ date, time, place: null }, Date.now());
  return v.ok ? 'OK' : v.error;
}
const place: Place = {
  placeId: 'ChIJstubDokk1Aarhus01',
  name: 'Dokk1',
  address: 'Hack Kampmanns Plads 2, Aarhus',
  lat: 56.1535,
  lng: 10.2142,
  type: 'library',
  mapUrl: googleMapsPlaceUrl('ChIJstubDokk1Aarhus01', 'Dokk1'),
};
const roster = {
  me: { firstName: 'Mia', photoV: null, aboutMe: 'Me, myself.' },
  anna: { firstName: 'Anna', photoV: null, aboutMe: 'Loves long walks.' },
  bo: { firstName: 'Bo', photoV: null },
};
const interests = { en: ['sourdough', 'coffee'], da: ['surdej', 'kaffe'] };

function planning() {
  mockCard = { state: 'planning', myStatus: 'accepted', themeLabel: 'Brætspil', themeSensitive: false };
  mockPod = {
    state: 'planning',
    memberUids: ['me', 'anna', 'bo'],
    roster,
    podInterests: interests,
    planning: { deadline: ts(Date.now() + 20 * HOUR) },
    confirmedAt: ts(Date.now() - DAY_MS),
  };
}
function scheduled(meetupIn: number) {
  const meetupAt = Date.now() + meetupIn;
  mockCard = { state: 'scheduled', myStatus: 'accepted', themeLabel: 'Brætspil', themeSensitive: false };
  mockPod = {
    state: 'scheduled',
    memberUids: ['me', 'anna', 'bo'],
    roster,
    podInterests: interests,
    planning: { deadline: ts(meetupAt - 5 * DAY_MS), meetupAt: ts(meetupAt), place, planLockedAt: ts(meetupAt - 5 * DAY_MS) },
    attendance: { me: 'coming', anna: 'coming', bo: 'coming' },
    confirmedAt: ts(Date.now() - 10 * DAY_MS),
  };
}
function message(id: string, authorUid: string, minutesAgo: number) {
  const createdAt = Date.now() - minutesAgo * 60_000;
  return { id, data: { authorUid, text: `Message ${id}`, createdAt: ts(createdAt), expiresAt: ts(createdAt + 72 * HOUR) } };
}

let client: QueryClient;
async function renderWithClient(ui: React.ReactElement) {
  client ??= new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false }, mutations: { retry: false, gcTime: Infinity } } });
  await render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  // The chat's read position comes from the device store.
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  for (const key of Object.keys(mockStore)) delete mockStore[key];
  mockMessages = [];
  mockRouter.push.mockClear();
  mockRouter.dismissTo.mockClear();
  client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false }, mutations: { retry: false, gcTime: Infinity } } });
});
afterEach(() => client.clear());

describe('3.1 pod confirmed', () => {
  it('is the hero, the pod interests and "Meeting safely": no Members list and no Leave button in the page', async () => {
    planning();
    await renderWithClient(<PodScreen />);
    expect(screen.getByText('More than one of you also likes')).toBeOnTheScreen();
    expect(screen.getByTestId('meeting-safely')).toBeOnTheScreen();
    expect(screen.queryByText('Members')).toBeNull();
    expect(screen.queryByText('Loves long walks.')).toBeNull();
    // Leaving is the pod menu by the back button, not a button in the page.
    expect(screen.getByTestId('pod-menu')).toHaveProp('accessibilityLabel', 'Leave pod');
    expect(screen.queryByText('Leave pod')).toBeNull();
  });

  it('opens a member sheet from the hero avatars; the viewer is plain text', async () => {
    planning();
    await renderWithClient(<PodScreen />);
    await fireEvent.press(screen.getByRole('link', { name: 'Anna, Loves long walks.' }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/pod/[podId]/member/[uid]', params: { podId: POD_ID, uid: 'anna' } });
    expect(screen.getByLabelText('Mia (you)')).toBeOnTheScreen();
    expect(screen.queryByRole('link', { name: /^Mia/ })).toBeNull();
  });

  // The tab bar under the pod page is the tab navigator's own: the page is in the Pods tab's stack (navigation.test).
});

describe('3.4 pod page', () => {
  it('lists the other members only, and ends with Members: no interests, no "Meeting safely" card, no Leave button', async () => {
    scheduled(30 * HOUR);
    await renderWithClient(<PodScreen />);
    expect(screen.getByText('Members')).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Anna, Coming, Loves long walks.' })).toBeOnTheScreen();
    expect(screen.queryByText('Mia (you)')).toBeNull();
    expect(screen.queryByText('Me, myself.')).toBeNull();
    expect(screen.queryByText('More than one of you also likes')).toBeNull();
    expect(screen.queryByTestId('meeting-safely')).toBeNull();
    expect(screen.queryByText('Leave pod')).toBeNull();
    expect(screen.getByTestId('pod-menu')).toBeOnTheScreen();
  });

  it('keeps the safety tips one tap away from the plan before the meetup', async () => {
    scheduled(30 * HOUR);
    await renderWithClient(<PodScreen />);
    await fireEvent.press(screen.getByTestId('safety-tips'));
    expect(mockRouter.push).toHaveBeenCalledWith('/info/safety');
  });

  it('shows the amber "new" badge for other members\' messages after the last read one, instead of the chevron', async () => {
    scheduled(2 * HOUR);
    mockMessages = [message('m1', 'anna', 30), message('m2', 'me', 20), message('m3', 'bo', 10)];
    await renderWithClient(<PodScreen />);
    expect(screen.getByTestId('pod-chat-unread')).toHaveTextContent('2 new');
    expect(screen.getByTestId('pod-chat').props.accessibilityLabel).toMatch(/, 2 new messages$/);
    client.clear();

    // Read up to Anna's message on this device: only Bo's is new.
    const m1 = (mockMessages[0] as { data: { createdAt: { toMillis(): number } } }).data.createdAt.toMillis();
    mockStore['chatRead.me'] = JSON.stringify({ [POD_ID]: m1 });
    await renderWithClient(<PodScreen />);
    expect(screen.getByTestId('pod-chat-unread')).toHaveTextContent('1 new');
  });

  it('opening the chat marks its messages read, so the badge goes', async () => {
    scheduled(2 * HOUR);
    mockMessages = [message('m1', 'anna', 30), message('m3', 'bo', 10)];
    await renderWithClient(<ChatScreen />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const newest = (mockMessages[1] as { data: { createdAt: { toMillis(): number } } }).data.createdAt.toMillis();
    expect(JSON.parse(mockStore['chatRead.me'] ?? '{}')).toEqual({ [POD_ID]: newest });
    await renderWithClient(<PodScreen />);
    expect(screen.queryByTestId('pod-chat-unread')).toBeNull();
  });
});

describe('3.5 chat', () => {
  function SendColour({ enabled, value }: { enabled: boolean; value: string }) {
    return <Composer value={value} onChangeText={() => undefined} onSend={() => undefined} enabled={enabled} busy={false} />;
  }
  const background = () => StyleSheet.flatten(screen.getByTestId('chat-send').props.style).backgroundColor as string;
  let primary = '';
  let disabledBg = '';
  function Palette() {
    const p = usePalette();
    primary = p.primary;
    disabledBg = p.disabledBg;
    return null;
  }

  it('Send is the green circle while the chat is open, even with nothing typed (then it does nothing)', async () => {
    await render(
      <>
        <Palette />
        <SendColour enabled value="" />
      </>,
    );
    expect(background()).toBe(primary);
    expect(screen.getByTestId('chat-send')).toBeDisabled();
    await render(<SendColour enabled={false} value="" />);
    expect(background()).toBe(disabledBg);
  });

  it('the contact-details note is one paragraph with only "You haven\'t met yet." in bold', async () => {
    const { callFunction } = jest.requireMock<{ callFunction: jest.Mock }>('@/firebase/callables');
    callFunction.mockResolvedValueOnce({ warnings: ['CONTACT_INFO_BEFORE_MEETUP'] });
    scheduled(2 * HOUR);
    await renderWithClient(<ChatScreen />);
    await fireEvent.changeText(screen.getByLabelText('Message'), 'Ring på 12345678');
    await fireEvent.press(screen.getByTestId('chat-send'));
    await act(async () => {
      await Promise.resolve();
    });
    const alert = screen.getByRole('alert', { name: "You haven't met yet. It's fine to wait until after." });
    expect(alert).toHaveProp('accessibilityHint', 'Your message contains contact details, such as a phone number, an email, a handle or a link.');
    expect(within(alert).getByText("You haven't met yet.")).toBeOnTheScreen();
    expect(screen.queryByText('Your message contains contact details, such as a phone number, an email, a handle or a link.')).toBeNull();
  });
});

describe('3.2 option card', () => {
  it('shows the place on one line as "name, area"', async () => {
    await render(<PlanOptionCard id="o1" when="Sat 15 Nov, 14:00" place={place} yes={0} voters={[]} leading={false} mine={null} onVote={() => undefined} />);
    expect(screen.getByText('Dokk1, Aarhus')).toBeOnTheScreen();
    expect(screen.queryByText('Hack Kampmanns Plads 2, Aarhus')).toBeNull();
    expect(screen.getByTestId('open-map-o1')).toHaveProp('accessibilityLabel', 'Open in Maps: Dokk1, Hack Kampmanns Plads 2, Aarhus');
  });

  it('takes the town from a short address', () => {
    expect(placeArea('Hack Kampmanns Plads 2, Aarhus')).toBe('Aarhus');
    expect(placeArea('Åboulevarden 1, 8000 Aarhus C')).toBe('Aarhus C');
    expect(placeArea('Aarhus')).toBe('');
  });

  it('still refuses a time outside 08:00–22:00 (the pickers offer none, the server mirrors the check)', () => {
    expect(validateOptionFormTimes('23:00')).toBe('WINDOW');
    expect(validateOptionFormTimes('18:30')).toBe('PLACE');
  });
});
