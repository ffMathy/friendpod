import { DAY_MS, googleMapsPlaceUrl } from '@grouper/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createEventInCalendarAsync } from 'expo-calendar/legacy';
import { Alert, Linking, type AlertButton } from 'react-native';
import PodScreen from '../app/pod/[podId]/index';

const POD_ID = 'abcdefghijklmnopqrst';
const HOUR = 3_600_000;

const mockRouter = { push: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({ podId: 'abcdefghijklmnopqrst' }) }));
jest.mock('expo-calendar/legacy', () => ({ createEventInCalendarAsync: jest.fn(async () => ({ action: 'saved' })) }));
jest.mock('@/features/session/SessionProvider', () => ({ useUid: () => 'me' }));
jest.mock('@/features/pods/ScreenCaptureGuard', () => ({ ScreenCaptureGuard: () => null }));
jest.mock('@/features/photos/AuthenticatedPhoto', () => ({ AuthenticatedPhoto: () => null }));
jest.mock('@/features/account/useDeviceCacheHygiene', () => ({ rememberCachedMessages: async () => undefined }));

const live = (data: unknown) => ({ data, error: null, isLoading: false });
let mockCard: Record<string, unknown> = {};
let mockPod: Record<string, unknown> = {};
let mockOptions: unknown[] = [];
jest.mock('@/data/docs', () => ({
  usePodCard: () => live(mockCard),
  usePod: () => live(mockPod),
  usePodOptions: () => live(mockOptions),
  usePodMessages: () => live([]),
  useUserDoc: () => live({ area: { areaId: 'vejle' } }),
  useAreaDoc: () => live(null),
}));

const mockCall = jest.fn();
jest.mock('@/firebase/callables', () => ({
  callFunction: (...args: unknown[]) => mockCall(...args),
  toAppError: (e: unknown) => e,
}));

const ts = (ms: number) => ({ toMillis: () => ms });
const place = {
  placeId: 'ChIJstubDokk1Aarhus01',
  name: 'Dokk1',
  address: 'Hack Kampmanns Plads 2, Aarhus',
  lat: 56.1535,
  lng: 10.2142,
  type: 'library',
  mapUrl: googleMapsPlaceUrl('ChIJstubDokk1Aarhus01', 'Dokk1'),
};
const roster = { me: { firstName: 'Mia', photoV: null }, anna: { firstName: 'Anna', photoV: null }, bo: { firstName: 'Bo', photoV: null } };

function scheduled(meetupIn: number, attendance: Record<string, string>, lockedBefore: number = 5 * DAY_MS) {
  const meetupAt = Date.now() + meetupIn;
  mockCard = { state: 'scheduled', myStatus: 'accepted', themeLabel: 'Brætspil', themeSensitive: false };
  mockPod = {
    state: 'scheduled',
    memberUids: ['me', 'anna', 'bo'],
    roster,
    podInterests: { da: [], en: [] },
    planning: { deadline: ts(meetupAt - lockedBefore), meetupAt: ts(meetupAt), place, planLockedAt: ts(meetupAt - lockedBefore) },
    attendance,
    confirmedAt: ts(Date.now() - 10 * DAY_MS),
  };
}

let client: QueryClient;
async function renderPod() {
  client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  await render(
    <QueryClientProvider client={client}>
      <PodScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockCall.mockReset();
  mockRouter.push.mockClear();
  mockOptions = [];
  jest.mocked(createEventInCalendarAsync).mockClear();
});
afterEach(() => client.clear());

describe('pod screen (D13)', () => {
  it('asks "Still coming?" as the one next step, and "Can\'t make it" calls confirmAttendance after a confirmation', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockCall.mockResolvedValue({ ok: true });
    scheduled(30 * HOUR, { me: 'pending', anna: 'coming', bo: 'coming' });
    await renderPod();
    expect(screen.getByText(/^Still coming on /)).toBeOnTheScreen();
    expect(screen.getAllByTestId('attendance-cant')).toHaveLength(1);

    await fireEvent.press(screen.getByTestId('attendance-cant'));
    expect(mockCall).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0]?.[2] as AlertButton[];
    await act(async () => {
      buttons.find((b) => b.style === 'destructive')?.onPress?.();
    });
    expect(mockCall).toHaveBeenCalledWith('confirmAttendance', { podId: POD_ID, coming: false });
    alert.mockRestore();
  });

  it('asks "Still coming?" from the plan-lock time, not from confirmation: a late-locked plan waits for T−24 h', async () => {
    // Confirmed 10 days ago, but the plan locked only 30 h before the meetup: the first ask is at T−24 h, 4 h from now.
    scheduled(28 * HOUR, { me: 'pending', anna: 'coming', bo: 'coming' }, 30 * HOUR);
    await renderPod();
    expect(screen.queryByText(/^Still coming on /)).toBeNull();
    expect(screen.queryByTestId('next-step')).toBeNull();
  });

  it('shows "<firstName> hasn\'t confirmed" for unconfirmed members only', async () => {
    scheduled(2 * HOUR, { me: 'coming', anna: 'unconfirmed', bo: 'notComing' });
    await renderPod();
    expect(screen.getByRole('link', { name: "Anna, Hasn't confirmed" })).toBeOnTheScreen();
    expect(screen.getAllByText("Hasn't confirmed")).toHaveLength(1);
    // Bo's status line, plus the viewer's own "Can't make it" on the attendance line.
    expect(screen.getAllByText("Can't make it")).toHaveLength(2);
    expect(screen.getByTestId('attendance-cant')).toBeOnTheScreen();
    // Already answered: the chat is the next step, and the calm attendance line sits in the Plan section.
    expect(screen.getByText('The meetup chat is open')).toBeOnTheScreen();
    expect(screen.getByText("You're coming.")).toBeOnTheScreen();
  });

  it('adds the meetup to the calendar in one tap, without the theme', async () => {
    scheduled(30 * HOUR, { me: 'coming', anna: 'coming', bo: 'coming' });
    const meetupAt = (mockPod.planning as { meetupAt: { toMillis(): number } }).meetupAt.toMillis();
    await renderPod();
    await fireEvent.press(screen.getByTestId('add-to-calendar'));
    expect(createEventInCalendarAsync).toHaveBeenCalledTimes(1);
    expect(createEventInCalendarAsync).toHaveBeenCalledWith({
      title: 'Pod meetup',
      startDate: new Date(meetupAt),
      endDate: new Date(meetupAt + 2 * HOUR),
      location: 'Dokk1, Hack Kampmanns Plads 2, Aarhus',
    });
    expect(JSON.stringify(jest.mocked(createEventInCalendarAsync).mock.calls)).not.toContain('Brætspil');
  });

  it('during the extension round, the next step says "No time works yet — add another option"', async () => {
    mockCard = { state: 'planning', myStatus: 'accepted', themeLabel: 'Brætspil', themeSensitive: false };
    mockPod = {
      state: 'planning',
      memberUids: ['me', 'anna'],
      roster,
      podInterests: { da: [], en: [] },
      planning: { deadline: ts(Date.now() + 20 * HOUR), extended: true },
      confirmedAt: ts(Date.now() - 4 * DAY_MS),
    };
    mockOptions = [{ id: 'opt1', data: { votes: { anna: 'yes' } } }];
    await renderPod();
    expect(screen.getByText('No time works yet — add another option')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('next-step'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/pod/[podId]/plan', params: { podId: POD_ID } });
  });

  it('keeps the extension card when the viewer has voted on every option, and asks for a first option in a new round', async () => {
    mockCard = { state: 'planning', myStatus: 'accepted', themeLabel: 'Brætspil', themeSensitive: false };
    const planning = (extended: boolean) => ({
      state: 'planning',
      memberUids: ['me', 'anna'],
      roster,
      podInterests: { da: [], en: [] },
      planning: { deadline: ts(Date.now() + 20 * HOUR), extended },
      confirmedAt: ts(Date.now() - 4 * DAY_MS),
    });
    mockPod = planning(true);
    mockOptions = [{ id: 'opt1', data: { votes: { me: 'no', anna: 'yes' } } }];
    await renderPod();
    expect(screen.getByText('No time works yet — add another option')).toBeOnTheScreen();
    expect(screen.getByTestId('next-step')).toHaveTextContent('Plan the meetup');
    client.clear();

    mockPod = planning(false);
    mockOptions = [];
    await renderPod();
    expect(screen.getByText(/^Pick a time by /)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('next-step'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/pod/[podId]/plan', params: { podId: POD_ID } });
  });

  it('leaves the pod only after a confirmation, then goes back', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockCall.mockResolvedValue({ ok: true });
    scheduled(30 * HOUR, { me: 'coming', anna: 'coming', bo: 'coming' });
    await renderPod();
    await fireEvent.press(screen.getByRole('button', { name: 'Leave pod' }));
    expect(mockCall).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0]?.[2] as AlertButton[];
    await act(async () => {
      buttons.find((b) => b.style === 'destructive')?.onPress?.();
    });
    expect(mockCall).toHaveBeenCalledWith('leavePod', { podId: POD_ID });
    expect(mockRouter.back).toHaveBeenCalled();
    alert.mockRestore();
  });

  it('lists members with their "about me", opens a member sheet, and opens the place in Maps', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    scheduled(30 * HOUR, { me: 'coming', anna: 'coming', bo: 'coming' });
    (mockPod.roster as Record<string, Record<string, unknown>>).anna = { firstName: 'Anna', photoV: null, aboutMe: 'Loves long walks.' };
    await renderPod();
    expect(screen.getByText('Loves long walks.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('link', { name: /^Anna/ }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/pod/[podId]/member/[uid]', params: { podId: POD_ID, uid: 'anna' } });
    await fireEvent.press(screen.getByTestId('open-map'));
    expect(openURL).toHaveBeenCalledWith(place.mapUrl);
    openURL.mockRestore();
  });

  it('before confirmation shows the proposal card instead of the pod', async () => {
    mockCard = {
      state: 'proposed',
      myStatus: 'invited',
      themeLabel: 'Brætspil',
      themeSensitive: false,
      sizeTarget: 5,
      acceptedCount: 1,
      acceptBy: ts(Date.now() + DAY_MS),
      reasons: [],
      areaLabel: 'Aarhus C',
    };
    await renderPod();
    expect(screen.getByRole('button', { name: "I'm in" })).toBeOnTheScreen();
    expect(screen.queryByText('Members')).toBeNull();
  });

  it('"I\'m coming" calls confirmAttendance at once; after "Can\'t make it" it reads "I\'m coming after all"', async () => {
    mockCall.mockResolvedValue({ ok: true });
    scheduled(30 * HOUR, { me: 'pending', anna: 'coming', bo: 'coming' });
    await renderPod();
    await fireEvent.press(screen.getByTestId('attendance-coming'));
    expect(mockCall).toHaveBeenCalledWith('confirmAttendance', { podId: POD_ID, coming: true });
    client.clear();

    scheduled(30 * HOUR, { me: 'notComing', anna: 'coming', bo: 'coming' });
    await renderPod();
    expect(screen.getByRole('button', { name: "I'm coming after all" })).toBeOnTheScreen();
    expect(screen.queryByTestId('attendance-cant')).toBeNull();
  });
});
