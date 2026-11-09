import { DAY_MS, googleMapsPlaceUrl } from '@friendpod/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { createEventInCalendarAsync } from 'expo-calendar/legacy';
import type React from 'react';
import type * as ReactNative from 'react-native';
import { Alert, Linking, type AlertButton } from 'react-native';
import PodScreen from '../app/pod/[podId]/index';
import { Colors, POD_PALETTE } from '@/components/theme';
import { markChatSeen } from '@/features/chat/readMarker';
import { podColorFor } from '@/lib/podColor';

const POD_ID = 'abcdefghijklmnopqrst';
const HOUR = 3_600_000;

const mockRouter = { push: jest.fn(), back: jest.fn(), dismissTo: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({ podId: 'abcdefghijklmnopqrst' }) }));
jest.mock('expo-calendar/legacy', () => ({ createEventInCalendarAsync: jest.fn(async () => ({ action: 'saved' })) }));
jest.mock('@/features/session/SessionProvider', () => ({ useUid: () => 'me' }));
jest.mock('@/features/pods/ScreenCaptureGuard', () => ({ ScreenCaptureGuard: () => null }));
// A photo is drawn only when the roster has a version for it; the stand-in marks where one would be.
jest.mock('@/features/photos/AuthenticatedPhoto', () => ({
  AuthenticatedPhoto: ({ owner }: { owner: string }) => {
    const { createElement } = jest.requireActual<typeof React>('react');
    const { View } = jest.requireActual<typeof ReactNative>('react-native');
    return createElement(View, { testID: `photo-${owner}` });
  },
}));
jest.mock('@/features/account/useDeviceCacheHygiene', () => ({ rememberCachedMessages: async () => undefined }));

const live = (data: unknown) => ({ data, error: null, isLoading: false });
let mockCard: Record<string, unknown> = {};
let mockPod: Record<string, unknown> = {};
let mockOptions: unknown[] = [];
let mockMessages: unknown[] = [];
jest.mock('@/data/docs', () => ({
  usePodCard: () => live(mockCard),
  usePod: () => live(mockPod),
  usePodOptions: () => live(mockOptions),
  usePodMessages: () => live(mockMessages),
  useUserDoc: () => live(null),
  useAreaDoc: () => live(null),
  // The proposal card (before confirmation) finds the pod's colour through the viewer's interests.
  useInterests: () => live([]),
}));

const mockCall = jest.fn();
jest.mock('@/firebase/callables', () => ({
  callFunction: (...args: unknown[]) => mockCall(...args),
  toAppError: (e: unknown) => e,
}));

const ts = (ms: number) => ({ toMillis: () => ms });

/** The pod's theme document (the colour comes from the card's word: "Brætspil" is Tomat). */
const THEME = { kind: 'concept', conceptId: 'seed_boardgames', sensitive: false };
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
  mockCard = { state: 'scheduled', myStatus: 'accepted', themeLabel: 'Brætspil', themeSensitive: false, reasons: [] };
  mockPod = {
    state: 'scheduled',
    theme: THEME,
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
  mockMessages = [];
  jest.mocked(createEventInCalendarAsync).mockClear();
});
afterEach(() => client.clear());

describe('pod screen (D13)', () => {
  it('asks "Still coming?" as the one next step, and "Can\'t make it" calls confirmAttendance after a confirmation', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockCall.mockResolvedValue({ ok: true });
    scheduled(30 * HOUR, { me: 'pending', anna: 'coming', bo: 'coming' });
    await renderPod();
    // The "Next step" card: "Still coming tomorrow at 14:00?" (or today, or on a weekday). "at" and the time are joined
    // by a no-break space, which the query's default normaliser reads as a space.
    expect(screen.getByText(/^Still coming (today|tomorrow|on \w+) at \d\d:\d\d\?$/)).toBeOnTheScreen();
    expect(screen.getByTestId('attendance-ask')).toBeOnTheScreen();
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
    expect(screen.queryByText(/^Still coming /)).toBeNull();
    expect(screen.queryByTestId('next-step')).toBeNull();
  });

  it('shows "<firstName> hasn\'t confirmed" for unconfirmed members only', async () => {
    scheduled(2 * HOUR, { me: 'coming', anna: 'unconfirmed', bo: 'notComing' });
    await renderPod();
    // The row reads "Hasn't confirmed"; screen readers hear "Anna hasn't confirmed".
    expect(screen.getByRole('link', { name: "Anna hasn't confirmed" })).toBeOnTheScreen();
    expect(screen.getByText("Hasn't confirmed")).toBeOnTheScreen();
    expect(screen.queryByRole('link', { name: /^Bo hasn't confirmed/ })).toBeNull();
    // Bo's status line, plus the viewer's own "Can't make it" on the attendance line.
    expect(screen.getAllByText("Can't make it")).toHaveLength(2);
    expect(screen.getByTestId('attendance-cant')).toBeOnTheScreen();
    // Already answered: the chat is the next step, and the calm attendance line sits in the Plan section.
    expect(screen.getByText('The meetup chat is open')).toBeOnTheScreen();
    expect(screen.getByText("You're coming.")).toBeOnTheScreen();
  });

  it('takes the pod colour from the theme word on the viewer\'s card; open-to-anyone from the pod id; a private pod stays quiet', async () => {
    // "Brætspil" (normalized "brætspil") is Tomat: the pod band is its tint.
    scheduled(30 * HOUR, { me: 'coming', anna: 'coming', bo: 'coming' });
    await renderPod();
    expect(screen.getByTestId('pod-band')).toHaveStyle({ backgroundColor: POD_PALETTE.tomat.tint });
    client.clear();

    scheduled(30 * HOUR, { me: 'coming', anna: 'coming', bo: 'coming' });
    // Another wording of the same theme is another word, so (accepted trade-off) another colour: "board games" is Bær.
    mockCard.themeLabel = 'board games';
    await renderPod();
    expect(screen.getByTestId('pod-band')).toHaveStyle({ backgroundColor: POD_PALETTE.baer.tint });
    client.clear();

    // Open to anyone: no concept, so the colour comes from the pod id.
    scheduled(30 * HOUR, { me: 'coming', anna: 'coming', bo: 'coming' });
    mockCard.themeLabel = null;
    mockPod.theme = { kind: 'openToAnyone' };
    await renderPod();
    const fromPodId = podColorFor({ podId: POD_ID });
    expect(fromPodId).not.toBeNull();
    expect(screen.getByTestId('pod-band')).toHaveStyle({ backgroundColor: POD_PALETTE[fromPodId ?? 'tomat'].tint });
    client.clear();

    // A private interest: no colour anywhere, a white band with an Ink border.
    scheduled(30 * HOUR, { me: 'coming', anna: 'coming', bo: 'coming' });
    mockCard.themeSensitive = true;
    mockPod.theme = { kind: 'concept', conceptId: 'c_9f8e7d6c5b4a39281706_p', sensitive: true };
    await renderPod();
    expect(screen.getByTestId('pod-band')).toHaveStyle({ backgroundColor: Colors.light.privateBg, borderColor: Colors.light.privateBorder });
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

  it('during the extension round, the pod says "No time works yet — add another option"', async () => {
    mockCard = { state: 'planning', myStatus: 'accepted', themeLabel: 'Brætspil', themeSensitive: false, reasons: [] };
    mockPod = {
      state: 'planning',
      theme: THEME,
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
    mockCard = { state: 'planning', myStatus: 'accepted', themeLabel: 'Brætspil', themeSensitive: false, reasons: [] };
    const planning = (extended: boolean) => ({
      state: 'planning',
      theme: THEME,
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
    // Nothing left for the viewer to vote on: the closing time is quiet (the plan page follows the same rule).
    expect(screen.getByTestId('deadline-quiet')).toHaveTextContent(/^Voting closes /);
    expect(screen.queryByTestId('deadline-needs-you')).toBeNull();
    client.clear();

    mockPod = planning(false);
    mockOptions = [];
    await renderPod();
    expect(screen.getByTestId('deadline-needs-you')).toHaveTextContent(/^Pick a time by /);
    await fireEvent.press(screen.getByTestId('next-step'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/pod/[podId]/plan', params: { podId: POD_ID } });
  });

  it('leaves the pod from the pod menu (§3.8), only after a confirmation, then goes back', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockCall.mockResolvedValue({ ok: true });
    scheduled(30 * HOUR, { me: 'coming', anna: 'coming', bo: 'coming' });
    await renderPod();
    // Not on the page itself: in the menu behind "⋯", with the safety tips.
    expect(screen.queryByRole('button', { name: 'Leave pod' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'More options' }));
    const menu = within(screen.getByTestId('pod-menu-sheet'));
    expect(menu.getByRole('link', { name: 'Meeting safely' })).toBeOnTheScreen();
    await fireEvent.press(menu.getByRole('button', { name: 'Leave pod' }));
    expect(mockCall).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0]?.[2] as AlertButton[];
    await act(async () => {
      buttons.find((b) => b.style === 'destructive')?.onPress?.();
    });
    expect(mockCall).toHaveBeenCalledWith('leavePod', { podId: POD_ID });
    expect(mockRouter.back).toHaveBeenCalled();
    alert.mockRestore();
  });

  it('sits on the Pods tab: the tab bar shows Pods selected, and a tab goes back down to it', async () => {
    scheduled(30 * HOUR, { me: 'coming', anna: 'coming', bo: 'coming' });
    await renderPod();
    expect(screen.getByRole('tab', { name: 'Pods' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'This week' })).not.toBeSelected();
    await fireEvent.press(screen.getByRole('tab', { name: 'This week' }));
    expect(mockRouter.dismissTo).toHaveBeenCalledWith('/');
    await fireEvent.press(screen.getByRole('tab', { name: 'Pods' }));
    expect(mockRouter.dismissTo).toHaveBeenLastCalledWith('/pods');
  });

  it('keeps the scheduled page to next step, Plan, Chat and Members (the pod interests belong to the reveal), safety tips sit by the map link', async () => {
    scheduled(30 * HOUR, { me: 'coming', anna: 'coming', bo: 'coming' });
    mockPod.podInterests = { da: ['surdej'], en: ['sourdough', 'coffee'] };
    await renderPod();
    // The page ends with the Members card (pod-scheduled: "one next-step card plus Plan, Chat and Members").
    expect(screen.getByTestId('pod-members')).not.toHaveTextContent(/also likes/);
    expect(screen.queryByTestId('pod-interests')).toBeNull();
    expect(screen.queryByText('More than one of you also likes')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Meeting safely' })).toBeNull();
    await fireEvent.press(screen.getByTestId('safety-tips'));
    expect(mockRouter.push).toHaveBeenLastCalledWith('/info/safety');
  });

  it('once the meetup is over, keeps the plan as a record of when and where: no calendar, map or safety links', async () => {
    scheduled(-20 * HOUR, { me: 'coming', anna: 'coming', bo: 'coming' });
    mockCard.state = 'happened';
    mockPod.state = 'happened';
    await renderPod();
    expect(screen.getByText('How did it go?')).toBeOnTheScreen();
    expect(screen.getByTestId('pod-plan')).toHaveTextContent(/Dokk1 · Hack Kampmanns Plads 2, Aarhus/);
    expect(screen.queryByTestId('add-to-calendar')).toBeNull();
    expect(screen.queryByTestId('open-map')).toBeNull();
    expect(screen.queryByTestId('safety-tips')).toBeNull();
    client.clear();

    // Still `scheduled` in the two hours after the start: the meetup is under way, so nothing to add or find either.
    scheduled(-HOUR, { me: 'coming', anna: 'coming', bo: 'coming' });
    await renderPod();
    expect(screen.getByTestId('pod-plan')).toHaveTextContent(/Dokk1/);
    expect(screen.queryByTestId('add-to-calendar')).toBeNull();
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
    // Under the drop's header, as on This week (opened from the Pods tab or a push, it is not a bare card).
    expect(screen.getByRole('header', { name: 'Your weekly drop' })).toBeOnTheScreen();
    expect(screen.getByText(/^Week \d{1,2}$/)).toBeOnTheScreen();
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

  it('shows how many chat messages are new: since the viewer last wrote, or last had the chat open', async () => {
    scheduled(2 * HOUR, { me: 'coming', anna: 'coming', bo: 'coming' });
    const msg = (id: string, authorUid: string, minutesAgo: number) => {
      const createdAt = Date.now() - minutesAgo * 60_000;
      return { id, data: { authorUid, text: id, createdAt: ts(createdAt), expiresAt: ts(Date.now() + 3 * DAY_MS) } };
    };
    mockMessages = [msg('m1', 'anna', 50), msg('m2', 'me', 40), msg('m3', 'bo', 30), msg('m4', 'anna', 20)];
    await renderPod();
    expect(screen.getByTestId('pod-chat-row')).toHaveTextContent(/2 new/);
    expect(screen.getByRole('link', { name: /^Chat, Open until .*, 2 new$/ })).toBeOnTheScreen();
    client.clear();

    // Opening the chat marks everything up to the newest message as seen.
    markChatSeen(POD_ID, Date.now() - 20 * 60_000);
    await renderPod();
    expect(screen.getByTestId('pod-chat-row')).not.toHaveTextContent(/new/);
    await fireEvent.press(screen.getByTestId('pod-chat-row'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/pod/[podId]/chat', params: { podId: POD_ID } });
  });

  it('in a pod about a private interest, photos stay hidden until each member shows theirs, and "Show my photo to this pod" calls setPhotoSharing', async () => {
    mockCall.mockResolvedValue({ ok: true });
    mockCard = { state: 'planning', myStatus: 'accepted', themeLabel: 'gravid', themeSensitive: true, reasons: [], acceptedCount: 3, areaLabel: 'Aarhus C', photoShared: false };
    mockPod = {
      state: 'planning',
      theme: { kind: 'concept', conceptId: 'c_9f8e7d6c5b4a39281706_p', sensitive: true },
      areaLabel: 'Aarhus C',
      memberUids: ['me', 'anna', 'bo'],
      // S6: the roster carries a photo version only for a member who chose to show theirs (Anna).
      roster: { me: { firstName: 'Mia', photoV: null }, anna: { firstName: 'Anna', photoV: 2 }, bo: { firstName: 'Bo', photoV: null } },
      podInterests: { da: [], en: [] },
      planning: { deadline: ts(Date.now() + 20 * HOUR) },
      confirmedAt: ts(Date.now() - DAY_MS),
    };
    await renderPod();
    expect(within(screen.getByTestId('pod-confirmed')).getByLabelText('Private interest')).toBeOnTheScreen();
    // Avatars are decorative (the names sit beside them), so they are hidden from screen readers.
    expect(screen.getByTestId('photo-anna', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.queryByTestId('photo-bo', { includeHiddenElements: true })).toBeNull();
    const toggle = screen.getByRole('switch', { name: 'Show my photo to this pod' });
    expect(toggle).not.toBeChecked();
    await fireEvent.press(toggle);
    expect(mockCall).toHaveBeenCalledWith('setPhotoSharing', { podId: POD_ID, share: true });
  });

  it('while planning shows the reveal: every member opens their sheet, "about me" sentences, pod interests', async () => {
    mockCard = { state: 'planning', myStatus: 'accepted', themeLabel: 'Brætspil', themeSensitive: false, reasons: [], acceptedCount: 3, areaLabel: 'Aarhus C' };
    mockPod = {
      state: 'planning',
      theme: THEME,
      areaLabel: 'Aarhus C',
      memberUids: ['me', 'anna', 'bo'],
      roster: { ...roster, anna: { firstName: 'Anna', photoV: null, aboutMe: 'Loves long walks.' } },
      podInterests: { da: ['surdej'], en: ['sourdough', 'coffee', 'brætspilsaften'] },
      planning: { deadline: ts(Date.now() + 20 * HOUR) },
      confirmedAt: ts(Date.now() - DAY_MS),
    };
    await renderPod();
    expect(screen.getByTestId('pod-confirmed')).toHaveTextContent(/Confirmed/);
    expect(screen.getByText('3 people near Aarhus C')).toBeOnTheScreen();
    expect(screen.getByLabelText('Mia (you)')).toBeOnTheScreen();
    expect(screen.getByText('In their own words')).toBeOnTheScreen();
    expect(screen.getByText(/Loves long walks\./)).toBeOnTheScreen();
    expect(screen.getByText('More than one of you also likes')).toBeOnTheScreen();
    expect(screen.getByText('coffee')).toBeOnTheScreen();
    // Each in its own word's colour (sourdough Solsikke, coffee Bær); "brætspilsaften" is Tomat like this pod, so it is
    // the plain clash chip (white, Outline border).
    const chips = within(screen.getByTestId('pod-interests')).getAllByTestId('pod-interest-chip');
    expect(chips).toHaveLength(3);
    expect(chips[0]).toHaveStyle({ backgroundColor: POD_PALETTE.solsikke.tint });
    expect(chips[1]).toHaveStyle({ backgroundColor: POD_PALETTE.baer.tint });
    expect(chips[2]).toHaveStyle({ backgroundColor: Colors.light.surface, borderColor: Colors.light.borderStrong });
    await fireEvent.press(screen.getByRole('link', { name: 'Bo' }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/pod/[podId]/member/[uid]', params: { podId: POD_ID, uid: 'bo' } });
    // "Meeting safely" folds open, with a link to every tip.
    expect(screen.queryByText(/^Meet in a public place/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Meeting safely' }));
    expect(screen.getByText(/^Meet in a public place/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('link', { name: 'All safety tips' }));
    expect(mockRouter.push).toHaveBeenLastCalledWith('/info/safety');
  });
});
