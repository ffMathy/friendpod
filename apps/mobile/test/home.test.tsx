import { fromLocal, setParticipationInput, updateProfileInput } from '@grouper/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import ThisWeek from '../app/(tabs)/index';
import Pods from '../app/(tabs)/pods';
import { i18n } from '@/i18n';

/** "This week" (drop-home, drop-proposal, drop-waiting, drop-none, priv-sensitive) and the Pods tab. */

const mockRouter = { push: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('expo-router/js-tabs', () => ({ Tabs: { Screen: () => null } }));
jest.mock('@/features/session/SessionProvider', () => ({ useUid: () => 'me' }));
jest.mock('@/features/pods/ScreenCaptureGuard', () => ({ ScreenCaptureGuard: () => null }));

const mockCall = jest.fn();
jest.mock('@/firebase/callables', () => ({
  callFunction: (...args: unknown[]) => mockCall(...args),
  toAppError: (e: unknown) => e,
}));

const at = (y: number, mo: number, d: number, h: number, mi = 0) => fromLocal({ year: y, month: mo, day: d, hour: h, minute: mi });
const ts = (ms: number) => ({ toMillis: () => ms });
const live = (data: unknown) => ({ data, error: null, isLoading: false });
const PREFS = { ageMin: 28, ageMax: 42, maxKm: 10, languages: ['da', 'en'], availability: 63, sameGenderOnly: false, openToAnyone: false };

let mockUser: Record<string, unknown> = {};
let mockCards: unknown[] = [];
let mockPods: Record<string, unknown> = {};
const mockInterests = [
  { id: 'i1', data: { display: 'brætspil', norm: 'brætspil', conceptId: 'seed_board_games', starred: true, createdAt: ts(1) } },
  { id: 'i2', data: { display: 'sourdough', norm: 'sourdough', conceptId: 'seed_sourdough', starred: false, createdAt: ts(2) } },
];
jest.mock('@/data/docs', () => ({
  useUserDoc: () => live(mockUser),
  usePodCards: () => live(mockCards),
  useAreaDoc: () => live({ label: { da: 'Aarhus', en: 'Aarhus' }, status: 'live', profile: 'launch', waitlistCount: 400, goal: { waitlist: 250 } }),
  useInterests: () => live(mockInterests),
  usePod: (podId: string, member: boolean) => live(member ? mockPods[podId] : undefined),
}));

function user(over: Record<string, unknown> = {}) {
  return {
    firstName: 'Emil',
    area: { gh5: 'u1zr2', label: 'Aarhus C', areaId: 'aarhus' },
    prefs: PREFS,
    participation: { mode: 'auto' },
    status: 'active',
    lastDrop: null,
    ...over,
  };
}
function card(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    data: {
      state: 'proposed',
      myStatus: 'invited',
      themeLabel: 'brætspil',
      themeSensitive: false,
      sizeTarget: 5,
      acceptedCount: 2,
      acceptBy: ts(at(2026, 11, 14, 18)),
      reasons: [{ code: 'THEME', yourWording: 'brætspil' }],
      areaLabel: 'Aarhus C',
      ageSpan: { min: 29, max: 38 },
      ...over,
    },
  };
}
const SOURDOUGH = card('sourdoughpodaarhus45', { state: 'scheduled', myStatus: 'accepted', themeLabel: 'sourdough', sizeTarget: 4, acceptedCount: 4 });
const sourdoughPod = {
  memberUids: ['u_laura', 'u_kasper', 'u_nadia', 'me'],
  roster: { u_laura: { firstName: 'Laura' }, u_kasper: { firstName: 'Kasper' }, u_nadia: { firstName: 'Nadia' }, me: { firstName: 'Emil' } },
  planning: {
    deadline: ts(at(2026, 11, 10, 18)),
    meetupAt: ts(at(2026, 11, 14, 14)),
    place: { name: '[Bakery café]', address: 'Frederiksbjerg, Aarhus C' },
  },
};

let client: QueryClient;
async function renderWith(ui: ReactElement) {
  client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: Infinity } } });
  await render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}
function setNow(ms: number) {
  jest.spyOn(Date, 'now').mockReturnValue(ms);
}
beforeEach(() => {
  mockCall.mockReset();
  mockRouter.push.mockClear();
  mockUser = user();
  mockCards = [];
  mockPods = {};
});
afterEach(() => {
  client.clear();
  jest.restoreAllMocks();
});

describe('Home before the drop (drop-home)', () => {
  beforeEach(() => setNow(at(2026, 11, 10, 12)));

  it('shows the week, the next drop with its countdown, and that the viewer is in', async () => {
    await renderWith(<ThisWeek />);
    expect(screen.getByRole('header', { name: 'This week' })).toBeOnTheScreen();
    expect(screen.getByText('Week 46')).toBeOnTheScreen();
    expect(screen.getByText('Next drop')).toBeOnTheScreen();
    expect(screen.getByText('Thursday 18:00')).toBeOnTheScreen();
    expect(screen.getByText('in 2 days and 6 hours')).toBeOnTheScreen();
    expect(screen.getByText("You're in this week")).toBeOnTheScreen();
  });

  it('"Skip this week" and "Pause matching" call setParticipation at once', async () => {
    mockCall.mockResolvedValue({ effectiveWeekId: '2026-W46' });
    await renderWith(<ThisWeek />);
    await fireEvent.press(screen.getByRole('button', { name: 'Skip this week' }));
    expect(mockCall).toHaveBeenLastCalledWith('setParticipation', { mode: 'skipNext' });
    await fireEvent.press(screen.getByRole('button', { name: 'Pause matching' }));
    expect(mockCall).toHaveBeenLastCalledWith('setParticipation', { mode: 'pause' });
    for (const [, input] of mockCall.mock.calls) expect(setParticipationInput.safeParse(input).success).toBe(true);
  });

  it('a skipped week offers to join again; a pause the user set offers to resume', async () => {
    mockCall.mockResolvedValue({ effectiveWeekId: '2026-W46' });
    mockUser = user({ participation: { mode: 'auto', skipWeekId: '2026-W46' } });
    await renderWith(<ThisWeek />);
    expect(screen.getByText("You're skipping this week")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Join this week' }));
    expect(mockCall).toHaveBeenLastCalledWith('setParticipation', { mode: 'auto' });
    client.clear();

    mockUser = user({ status: 'paused', participation: { mode: 'auto', pauseReason: 'user' } });
    await renderWith(<ThisWeek />);
    expect(screen.getByText('Matching is paused')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Pause matching' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Resume matching' }));
    expect(mockCall).toHaveBeenLastCalledWith('setParticipation', { mode: 'auto' });
  });

  it('an automated safety pause cannot be lifted from Home', async () => {
    mockUser = user({ status: 'paused', participation: { mode: 'auto', pauseReason: 'reports', pausedUntil: ts(at(2026, 12, 8, 12)) } });
    await renderWith(<ThisWeek />);
    expect(screen.getByText(/^Matching is paused until /)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Resume matching' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Skip this week' })).toBeNull();
  });

  it('what we match on: ordinary interests, area, distance, ages and languages; Edit opens Interests', async () => {
    await renderWith(<ThisWeek />);
    const box = within(screen.getByTestId('match-on'));
    expect(box.getByText('brætspil')).toBeOnTheScreen();
    expect(box.getByText('sourdough')).toBeOnTheScreen();
    expect(box.getByText('Aarhus C · about 10 km · ages 28–42 · Dansk, English')).toBeOnTheScreen();
    await fireEvent.press(box.getByRole('link', { name: 'Edit' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/interests');
  });

  it('lists active pods with the other members\' initials, when and where, and opens the pod', async () => {
    mockCards = [SOURDOUGH, card('climbingpodaarhus42a', { state: 'archived', myStatus: 'accepted', themeLabel: 'climbing' })];
    mockPods = { sourdoughpodaarhus45: sourdoughPod };
    await renderWith(<ThisWeek />);
    expect(screen.getByText(/1 of 2 active/)).toBeOnTheScreen();
    expect(screen.getByText('Saturday 14:00 · [Bakery café], Frederiksbjerg')).toBeOnTheScreen();
    expect(screen.queryByText('climbing')).toBeNull();
    await fireEvent.press(screen.getByTestId('pod-row-sourdoughpodaarhus45'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/pod/[podId]', params: { podId: 'sourdoughpodaarhus45' } });
    await fireEvent.press(screen.getByRole('link', { name: 'How matching works' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/info/how-matching-works');
  });
});

describe('Home after the drop', () => {
  beforeEach(() => setNow(at(2026, 11, 12, 18, 30)));

  it('a proposal: "Your weekly drop" with the card and the threshold from the area\'s profile (drop-proposal)', async () => {
    mockUser = user({ lastDrop: { weekId: '2026-W46', outcome: 'proposed' } });
    mockCards = [card('braetspilpodaarhus46')];
    await renderWith(<ThisWeek />);
    expect(screen.getByRole('header', { name: 'Your weekly drop' })).toBeOnTheScreen();
    expect(screen.getByText('Answer by Sat 18:00')).toBeOnTheScreen();
    expect(screen.getByText('Names and photos appear when 4 people have said yes.')).toBeOnTheScreen();
    expect(screen.queryByTestId('next-drop')).toBeNull();
  });

  it('in Danish the deadline uses the short weekday, so it fits beside the badge (priv-sensitive)', async () => {
    mockUser = user({ lastDrop: { weekId: '2026-W46', outcome: 'proposed' } });
    mockCards = [card('braetspilpodaarhus46')];
    await i18n.changeLanguage('da');
    try {
      await renderWith(<ThisWeek />);
      expect(screen.getByText('Svar senest lør. kl. 18.00')).toBeOnTheScreen();
    } finally {
      await i18n.changeLanguage('en');
    }
  });

  it('after "I\'m in", Okay folds the waiting card into "Your pods" (drop-waiting)', async () => {
    mockCards = [card('braetspilpodaarhus46', { myStatus: 'accepted', acceptedCount: 3 })];
    await renderWith(<ThisWeek />);
    expect(screen.getByText('3 of 5 said yes')).toBeOnTheScreen();
    expect(screen.getByText('4 needed')).toBeOnTheScreen();
    await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Okay' })));
    expect(screen.getByTestId('next-drop')).toBeOnTheScreen();
    expect(screen.getByText('Waiting for the others · 3 of 5 said yes')).toBeOnTheScreen();
  });

  it('a backfill invitation into a pod that is already planning is answered on Home too', async () => {
    mockCards = [card('braetspilpodaarhus46', { state: 'planning', myStatus: 'invited', acceptedCount: 4 })];
    await renderWith(<ThisWeek />);
    expect(screen.getByRole('header', { name: 'Your weekly drop' })).toBeOnTheScreen();
    expect(screen.getByText("This pod is already confirmed. You'll see names and photos once you join.")).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: "I'm in" })).toBeOnTheScreen();
  });

  it('a declined or left proposal is not shown', async () => {
    mockCards = [card('braetspilpodaarhus46', { myStatus: 'declined' }), card('otherpodaarhus46aaaa', { myStatus: 'left' })];
    await renderWith(<ThisWeek />);
    expect(screen.getByTestId('next-drop')).toBeOnTheScreen();
    expect(screen.queryByTestId('proposal-braetspilpodaarhus46')).toBeNull();
    expect(screen.queryByTestId('proposal-otherpodaarhus46aaaa')).toBeNull();
  });

  it('no pod: the reason, priority next week, tips and the next drop; no setting named (drop-none)', async () => {
    mockUser = user({ lastDrop: { weekId: '2026-W46', outcome: 'unmatched', reason: 'NO_THEME_BUCKET' } });
    await renderWith(<ThisWeek />);
    expect(screen.getByRole('header', { name: 'No pod for you this week' })).toBeOnTheScreen();
    expect(
      screen.getByText("Not enough people near you shared one of your interests and fit everyone's settings this time. You'll get priority next week."),
    ).toBeOnTheScreen();
    expect(screen.getByText('Things that often help')).toBeOnTheScreen();
    expect(screen.queryByTestId('tip-preferences')).toBeNull();
    await fireEvent.press(screen.getByRole('link', { name: 'Add a few more interests' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/interests');
    await fireEvent.press(screen.getByRole('link', { name: 'Try about 15 km' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/settings/preferences');
    expect(screen.getByText('Next drop: Thursday 18:00')).toBeOnTheScreen();
  });

  it('"Open to meeting anyone" saves the preference', async () => {
    mockCall.mockResolvedValue({ ok: true });
    mockUser = user({ lastDrop: { weekId: '2026-W46', outcome: 'unmatched', reason: 'NO_FIT_THIS_WEEK' } });
    await renderWith(<ThisWeek />);
    const toggle = screen.getByRole('switch', { name: 'Open to meeting anyone' });
    expect(toggle.props.accessibilityState).toMatchObject({ checked: false });
    await fireEvent.press(toggle);
    expect(mockCall).toHaveBeenCalledWith('updateProfile', { prefs: { openToAnyone: true } });
    expect(updateProfileInput.safeParse(mockCall.mock.calls[0]?.[1]).success).toBe(true);
    expect(screen.getByRole('switch', { name: 'Open to meeting anyone' }).props.accessibilityState).toMatchObject({ checked: true });
  });

  it('a setting reason (sent after 3 weeks with the same cause) leads with that setting', async () => {
    mockUser = user({ lastDrop: { weekId: '2026-W46', outcome: 'unmatched', reason: 'AGE' } });
    await renderWith(<ThisWeek />);
    expect(screen.getByText(/^Your age range leaves too few people/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('link', { name: 'Widen your age range' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/settings/preferences');
  });

  it('from Monday, last week\'s no-pod answer gives way to the next drop', async () => {
    setNow(at(2026, 11, 16, 9));
    mockUser = user({ lastDrop: { weekId: '2026-W46', outcome: 'unmatched', reason: 'NO_THEME_BUCKET' } });
    await renderWith(<ThisWeek />);
    expect(screen.queryByText('No pod for you this week')).toBeNull();
    expect(screen.getByText('Week 47')).toBeOnTheScreen();
    expect(screen.getByText('in 3 days and 9 hours')).toBeOnTheScreen();
  });
});

describe('Pods tab', () => {
  beforeEach(() => setNow(at(2026, 11, 10, 12)));

  it('lists active and past pods as rows that open the pod', async () => {
    mockCards = [SOURDOUGH, card('climbingpodaarhus42a', { state: 'archived', myStatus: 'accepted', themeLabel: 'climbing' })];
    mockPods = { sourdoughpodaarhus45: sourdoughPod };
    await renderWith(<Pods />);
    expect(screen.getByRole('header', { name: /Active/ })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: /Past/ })).toBeOnTheScreen();
    expect(screen.getByText('climbing')).toBeOnTheScreen();
    expect(screen.getByText('Archived')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('link', { name: /^climbing/ }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/pod/[podId]', params: { podId: 'climbingpodaarhus42a' } });
  });

  it('a private interest is marked as such for screen readers; no pods at all shows the empty state', async () => {
    mockCards = [card('privatepodaarhusweek', { themeLabel: 'gravid', themeSensitive: true, ageSpan: undefined })];
    await renderWith(<Pods />);
    expect(screen.getByRole('link', { name: /^gravid, Private interest\. New pod · answer by Sat 18:00$/ })).toBeOnTheScreen();
    client.clear();

    mockCards = [];
    await renderWith(<Pods />);
    expect(screen.getByRole('header', { name: 'No pods yet' })).toBeOnTheScreen();
  });
});
