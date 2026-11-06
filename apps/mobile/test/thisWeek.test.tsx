import { latestReleasedDropWeek, nextDropWeek, setParticipationInput, updateProfileInput } from '@grouper/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import ThisWeek from '../app/(tabs)/index';

// Monday 9 November 2026, 11:00 in Copenhagen (ISO week 46): before Thursday's 12:00 opt-in cutoff and 18:00 drop.
const NOW = Date.UTC(2026, 10, 9, 10, 0);
const POD_ID = 'abcdefghijklmnopqrst';

const mockRouter = { push: jest.fn(), navigate: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('@/features/session/SessionProvider', () => ({ useUid: () => 'me' }));

const mockCall = jest.fn();
jest.mock('@/firebase/callables', () => ({
  callFunction: (...args: unknown[]) => mockCall(...args),
  toAppError: (e: unknown) => e,
}));

const ts = (ms: number) => ({ toMillis: () => ms });
const mockLive = (data: unknown) => ({ data, error: null, isLoading: false });

function user(over: Record<string, unknown> = {}) {
  return {
    firstName: 'Ea',
    locale: 'en',
    area: { gh5: 'u1zr2', label: 'Vejle', areaId: 'vejle' },
    prefs: { ageMin: 28, ageMax: 42, maxKm: 10, languages: ['da', 'en'], availability: [], sameGenderOnly: false, openToAnyone: false },
    participation: { mode: 'auto' },
    status: 'active',
    lastDrop: null,
    ...over,
  };
}
const mockAreaDoc = {
  label: { da: 'Vejle', en: 'Vejle' },
  status: 'live',
  profile: 'alpha',
  waitlistCount: 300,
  goal: { waitlist: 250, optedIn: 200, predictedMatchRate: 0.5, consecutiveWeeks: 2 },
  chips: [],
  configVersion: 2,
};
function card(over: Record<string, unknown> = {}) {
  return {
    state: 'proposed',
    myStatus: 'invited',
    themeLabel: 'brætspil',
    themeSensitive: false,
    sizeTarget: 5,
    acceptedCount: 0,
    acceptBy: ts(NOW + 5 * 86_400_000),
    reasons: [{ code: 'NEAR_YOU', km: 10 }],
    areaLabel: 'Vejle',
    ...over,
  };
}
const mockPodDoc = {
  state: 'planning',
  weekId: '2026-W45',
  areaLabel: 'Vejle',
  theme: { kind: 'concept', conceptId: 'c1', sensitive: false },
  memberUids: ['me', 'u2', 'u3'],
  roster: { me: { firstName: 'Ea', photoV: null }, u2: { firstName: 'Lars', photoV: null }, u3: { firstName: 'Nina', photoV: null } },
  podInterests: { da: [], en: [] },
  planning: { deadline: ts(NOW + 86_400_000) },
  confirmedAt: ts(NOW - 86_400_000),
};

let mockUser: unknown = user();
let mockCards: unknown[] = [];
jest.mock('@/data/docs', () => ({
  useUserDoc: () => mockLive(mockUser),
  usePodCards: () => mockLive(mockCards),
  useAreaDoc: () => mockLive(mockAreaDoc),
  useInterests: () =>
    mockLive([
      { id: 'i1', data: { display: 'brætspil', starred: false, state: 'active' } },
      { id: 'i2', data: { display: 'sourdough', starred: true, state: 'active' } },
    ]),
  useSensitiveInterests: () => mockLive([{ id: 's1', data: { display: 'gravid' } }]),
  usePod: () => mockLive(mockPodDoc),
}));

let client: QueryClient;
async function renderHome() {
  client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: Infinity } } });
  await render(
    <QueryClientProvider client={client}>
      <ThisWeek />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
  mockCall.mockReset().mockResolvedValue({ effectiveWeekId: '2026-W46' });
  mockRouter.push.mockClear();
  mockRouter.navigate.mockClear();
  mockUser = user();
  mockCards = [];
});
afterEach(() => {
  client.clear();
  jest.restoreAllMocks();
});

describe('This week (storyboards 2.1–2.5)', () => {
  it('before the drop: the next drop, and Skip this week / Pause matching call setParticipation', async () => {
    await renderHome();
    expect(screen.getByText('Thursday 18:00')).toBeOnTheScreen();
    expect(screen.getByText('in 3 days and 7 hours')).toBeOnTheScreen();
    expect(screen.getByText("You're in this week")).toBeOnTheScreen();
    expect(screen.queryByText('No pod for you this week')).toBeNull();

    await fireEvent.press(screen.getByTestId('home-skip'));
    expect(mockCall).toHaveBeenLastCalledWith('setParticipation', { mode: 'skipNext' });
    expect(setParticipationInput.safeParse(mockCall.mock.calls[0]?.[1]).success).toBe(true);
    await fireEvent.press(screen.getByTestId('home-pause'));
    expect(mockCall).toHaveBeenLastCalledWith('setParticipation', { mode: 'pause' });
  });

  it('what we match on: ordinary interests by name, private ones only as a count', async () => {
    await renderHome();
    expect(screen.getByText('sourdough')).toBeOnTheScreen();
    expect(screen.getByText('brætspil')).toBeOnTheScreen();
    expect(screen.getByText('1 private')).toBeOnTheScreen();
    expect(screen.queryByText('gravid')).toBeNull();
    expect(screen.getByText('Vejle · about 10 km · ages 28–42 · Dansk, English')).toBeOnTheScreen();
  });

  it('a skipped week can be undone before the cutoff, back to every week', async () => {
    mockUser = user({ participation: { mode: 'auto', skipWeekId: nextDropWeek(NOW) } });
    await renderHome();
    expect(screen.queryByTestId('home-skip')).toBeNull();
    await fireEvent.press(screen.getByTestId('home-undo-skip'));
    expect(mockCall).toHaveBeenLastCalledWith('setParticipation', { mode: 'auto' });
  });

  it('an automated safety pause offers no resume', async () => {
    mockUser = user({ status: 'paused', participation: { mode: 'auto', pauseReason: 'noShow', pausedUntil: ts(NOW + 7 * 86_400_000) } });
    await renderHome();
    expect(screen.getByText('Matching is paused')).toBeOnTheScreen();
    expect(screen.queryByTestId('home-resume')).toBeNull();
    expect(screen.queryByTestId('home-pause')).toBeNull();
  });

  it('a confirmed pod this week is shown and opened instead of "No pod"', async () => {
    mockUser = user({ lastDrop: { weekId: latestReleasedDropWeek(NOW), outcome: 'unmatched', reason: 'NO_THEME_BUCKET' } });
    mockCards = [{ id: POD_ID, data: card({ state: 'planning', myStatus: 'accepted', acceptedCount: 3 }) }];
    await renderHome();
    expect(screen.getByTestId(`home-pod-${POD_ID}`)).toBeOnTheScreen();
    expect(screen.queryByText('No pod for you this week')).toBeNull();
    await fireEvent.press(screen.getByTestId(`home-open-pod-${POD_ID}`));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/pod/[podId]', params: { podId: POD_ID } });
  });

  it('unmatched in the latest drop: the reason, what helps, and "Open to meeting anyone" saves the preference', async () => {
    mockUser = user({ lastDrop: { weekId: latestReleasedDropWeek(NOW), outcome: 'unmatched', reason: 'NO_THEME_BUCKET' } });
    mockCall.mockResolvedValue({ ok: true });
    await renderHome();
    expect(screen.getByText('No pod for you this week')).toBeOnTheScreen();
    expect(screen.getByText('Not enough people nearby share one of your interests yet.')).toBeOnTheScreen();
    expect(screen.getByTestId('home-try-km')).toBeOnTheScreen();
    await fireEvent(screen.getByTestId('home-open-to-anyone'), 'valueChange', true);
    expect(mockCall).toHaveBeenCalledWith('updateProfile', { prefs: { openToAnyone: true } });
    expect(updateProfileInput.safeParse(mockCall.mock.calls[0]?.[1]).success).toBe(true);
  });

  it('an older unmatched drop is not this week\'s news', async () => {
    mockUser = user({ lastDrop: { weekId: '2026-W43', outcome: 'unmatched', reason: 'NO_THEME_BUCKET' } });
    await renderHome();
    expect(screen.queryByText('No pod for you this week')).toBeNull();
    expect(screen.getByTestId('home-skip')).toBeOnTheScreen();
  });

  it('an open proposal: "Your weekly drop" with the card, the alpha threshold and no names', async () => {
    mockCards = [{ id: POD_ID, data: card() }];
    await renderHome();
    expect(screen.getByText('Your weekly drop')).toBeOnTheScreen();
    expect(screen.getByText('Week 46')).toBeOnTheScreen();
    expect(screen.getByText('Names and photos appear when 3 people have said yes.')).toBeOnTheScreen();
    expect(screen.queryByText(/Lars|Nina/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: "I'm in" }));
    expect(mockCall).toHaveBeenCalledWith('respondToPod', { podId: POD_ID, accept: true });
  });
});
