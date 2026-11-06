import { DAY_MS, googleMapsPlaceUrl, proposeOptionInput, toLocal, voteOptionInput } from '@grouper/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';
import Plan from '../app/pod/[podId]/plan';
import Propose from '../app/pod/[podId]/propose';
import { OPTION_TIME_SLOTS, optionDays, validateOptionForm } from '@/features/pods/optionForm';

const POD_ID = 'abcdefghijklmnopqrst';
const HOUR = 3_600_000;
const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({ podId: 'abcdefghijklmnopqrst' }) }));
jest.mock('expo-calendar/legacy', () => ({ createEventInCalendarAsync: jest.fn(async () => ({ action: 'saved' })) }));
jest.mock('@/features/session/SessionProvider', () => ({ useUid: () => 'me' }));
jest.mock('@/features/photos/AuthenticatedPhoto', () => ({ AuthenticatedPhoto: () => null }));

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
  type: 'library' as const,
  mapUrl: googleMapsPlaceUrl('ChIJstubDokk1Aarhus01', 'Dokk1'),
};
const live = (data: unknown) => ({ data, error: null, isLoading: false });
let mockCard: Record<string, unknown> = {};
let mockPod: Record<string, unknown> = {};
let mockOptions: unknown[] = [];
jest.mock('@/data/docs', () => ({
  usePodCard: () => live(mockCard),
  usePod: () => live(mockPod),
  usePodOptions: () => live(mockOptions),
  useUserDoc: () => live({ area: { gh5: 'u1zr2' } }),
}));

function planning(extended = false) {
  mockCard = { state: 'planning', myStatus: 'accepted', themeLabel: 'Brætspil', themeSensitive: false };
  mockPod = { state: 'planning', planning: { deadline: ts(Date.now() + 20 * HOUR), ...(extended ? { extended: true } : {}) } };
}
const option = (id: string, authorUid: string, votes: Record<string, string>) => ({
  id,
  data: { authorUid, startsAt: ts(Date.now() + 3 * DAY_MS), place, votes, createdAt: ts(Date.now()) },
});

let client: QueryClient;
async function renderScreen(Screen: () => React.ReactNode) {
  client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: Infinity } } });
  await render(
    <QueryClientProvider client={client}>
      <Screen />
    </QueryClientProvider>,
  );
}
const renderPlan = () => renderScreen(Plan);
const renderPropose = () => renderScreen(Propose);
beforeEach(() => {
  mockCall.mockReset();
  mockRouter.push.mockClear();
  mockRouter.back.mockClear();
  mockOptions = [];
});
afterEach(() => client.clear());

describe('planner (§3.5)', () => {
  it('votes yes and no on an option, and a second tap takes the vote back', async () => {
    planning();
    mockOptions = [option('opt1', 'anna', { anna: 'yes' })];
    mockCall.mockResolvedValue({ tally: { yes: 2, no: 0 } });
    await renderPlan();
    expect(screen.getByText('1 yes')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('vote-yes-opt1'));
    expect(mockCall).toHaveBeenLastCalledWith('voteOption', { podId: POD_ID, optionId: 'opt1', vote: 'yes' });
    await fireEvent.press(screen.getByTestId('vote-no-opt1'));
    expect(mockCall).toHaveBeenLastCalledWith('voteOption', { podId: POD_ID, optionId: 'opt1', vote: 'no' });
    for (const [, input] of mockCall.mock.calls) expect(voteOptionInput.safeParse(input).success).toBe(true);
    client.clear();

    mockOptions = [option('opt1', 'anna', { anna: 'yes', me: 'yes' })];
    await renderPlan();
    await fireEvent.press(screen.getByTestId('vote-yes-opt1'));
    expect(mockCall).toHaveBeenLastCalledWith('voteOption', { podId: POD_ID, optionId: 'opt1', vote: null });
  });

  it('shows the extension round with its new deadline', async () => {
    planning(true);
    mockOptions = [option('opt1', 'anna', { anna: 'no' })];
    await renderPlan();
    expect(screen.getByText('No time works yet — add another option')).toBeOnTheScreen();
    expect(screen.getByText(/^You have one more day, until /)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Suggest another time (2 spots left)' })).toBeOnTheScreen();
  });

  it('marks the option ahead as "Leading" and opens "Suggest a time" while spots are left', async () => {
    planning();
    const later = option('opt2', 'bo', { anna: 'yes', bo: 'yes', me: 'yes' });
    mockOptions = [option('opt1', 'anna', { anna: 'yes' }), { ...later, data: { ...later.data, startsAt: ts(Date.now() + 4 * DAY_MS) } }];
    await renderPlan();
    expect(screen.getAllByText('Leading')).toHaveLength(1);
    expect(screen.getByTestId('option-opt2')).toHaveTextContent(/Leading/);
    expect(screen.getByTestId('option-opt1')).not.toHaveTextContent(/Leading/);
    expect(screen.getByText('3 yes')).toBeOnTheScreen();
    expect(screen.getByTestId('vote-yes-opt2')).toBeSelected();
    expect(screen.getByTestId('vote-no-opt2')).not.toBeSelected();

    await fireEvent.press(screen.getByRole('button', { name: 'Suggest another time (1 spot left)' }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/pod/[podId]/propose', params: { podId: POD_ID } });
    client.clear();

    // Three options fill the planner: no more suggestions.
    mockOptions = [option('a', 'anna', {}), option('b', 'bo', {}), option('c', 'me', {})];
    await renderPlan();
    expect(screen.queryByTestId('suggest-time')).toBeNull();
  });

  it('proposes a time and a place picked from Places, in a shape proposeOption accepts', async () => {
    jest.useFakeTimers();
    planning();
    mockCall.mockResolvedValue({ optionId: 'newopt' });
    await renderPropose();
    const day = toLocal(Date.now() + 2 * DAY_MS);
    const ymd = `${day.year}-${String(day.month).padStart(2, '0')}-${String(day.day).padStart(2, '0')}`;

    // Nothing picked yet: the form says so and sends nothing.
    await fireEvent.press(screen.getByTestId('option-propose'));
    expect(screen.getByText('Pick a day and a time.')).toBeOnTheScreen();
    expect(mockCall).not.toHaveBeenCalled();

    // Day and Time open sheets of choices; the fields then read "Sun 15 Nov" and "18:30".
    await fireEvent.press(screen.getByRole('button', { name: 'Day, Pick a day' }));
    await fireEvent.press(screen.getByTestId(`option-day-${ymd}`));
    expect(screen.queryByTestId('option-day-sheet')).toBeNull();
    await fireEvent.press(screen.getByTestId('option-time'));
    await fireEvent.press(screen.getByTestId('option-time-18:30'));
    expect(screen.getByRole('button', { name: /^Day, [A-Z][a-z]+day \d{1,2} [A-Z][a-z]{2}$/ })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Time, 18:30' })).toBeOnTheScreen();

    // Without a place the form says so and sends nothing.
    await fireEvent.press(screen.getByTestId('option-propose'));
    expect(screen.getByText('Pick a public place from the list.')).toBeOnTheScreen();
    expect(mockCall).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByTestId('place-search'), 'café');
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    await fireEvent.press(screen.getByText('Café Nord'));
    await act(async () => {
      await Promise.resolve();
    });
    await fireEvent.press(screen.getByTestId('option-propose'));
    expect(mockCall).toHaveBeenCalledTimes(1);
    const [name, input] = mockCall.mock.calls[0] as [string, { startsAt: number; place: { name: string } }];
    expect(name).toBe('proposeOption');
    expect(proposeOptionInput.safeParse(input).success).toBe(true);
    expect(input.place.name).toBe('Café Nord');
    expect(toLocal(input.startsAt)).toMatchObject({ day: day.day, hour: 18, minute: 30 });
    // Sent: back to the planner.
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockRouter.back).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('offers only what the planner accepts: days within 14 days, every half hour from 08:00 to 22:00, nothing past', async () => {
    // Monday 9 Nov 2026, 12:10 in Copenhagen.
    jest.useFakeTimers({ now: Date.parse('2026-11-09T11:10:00Z') });
    planning();
    await renderPropose();
    await fireEvent.press(screen.getByTestId('option-date'));
    // Today still has open times; the last day is 14 days ahead, until this time of day.
    expect(screen.getByTestId('option-day-2026-11-09')).toBeOnTheScreen();
    expect(screen.getByTestId('option-day-2026-11-23')).toBeOnTheScreen();
    expect(screen.queryByTestId('option-day-2026-11-24')).toBeNull();
    expect(screen.getByRole('radio', { name: 'Monday 9 Nov' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('option-day-2026-11-09'));

    await fireEvent.press(screen.getByTestId('option-time'));
    expect(screen.getByTestId('option-time-08:00')).toBeOnTheScreen();
    expect(screen.getByTestId('option-time-22:00')).toBeOnTheScreen();
    expect(screen.queryByTestId('option-time-07:30')).toBeNull();
    expect(screen.queryByTestId('option-time-22:30')).toBeNull();
    // Earlier today is greyed out and can't be picked.
    expect(screen.getByTestId('option-time-12:00')).toBeDisabled();
    expect(screen.getByTestId('option-time-12:30')).toBeEnabled();
    await fireEvent.press(screen.getByTestId('option-time-12:00'));
    expect(screen.getByRole('button', { name: 'Time, Pick a time' })).toBeOnTheScreen();
    jest.useRealTimers();
  });

  it('still refuses a time outside the window on send (the clock moved on while the form was open)', () => {
    const now = Date.parse('2026-11-09T11:10:00Z');
    expect(validateOptionForm({ date: '2026-11-09', time: '12:00', place: null }, now)).toEqual({ ok: false, error: 'WINDOW' });
    expect(validateOptionForm({ date: '2026-11-10', time: '23:00', place: null }, now)).toEqual({ ok: false, error: 'WINDOW' });
    expect(validateOptionForm({ date: '2026-11-10', time: '', place: null }, now)).toEqual({ ok: false, error: 'DATE' });
    expect(validateOptionForm({ date: '2026-11-10', time: '12:00', place: null }, now)).toEqual({ ok: false, error: 'PLACE' });
    expect(OPTION_TIME_SLOTS.every((slot) => validateOptionForm({ date: '2026-11-10', time: slot, place }, now).ok)).toBe(true);
    expect(optionDays(now)).toHaveLength(15);
  });

  it("reports another member's option by pressing and holding it, but not one's own", async () => {
    planning();
    mockOptions = [option('opt1', 'anna', {}), option('opt2', 'me', {})];
    await renderPlan();
    // No visible "Report" on the cards; the footnote says how.
    expect(screen.queryByText('Report')).toBeNull();
    expect(screen.getByText(/Press and hold an option to report it\.$/)).toBeOnTheScreen();
    await fireEvent(screen.getByTestId('option-opt1'), 'longPress');
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/sheets/report', params: { podId: POD_ID, optionId: 'opt1' } });
    mockRouter.push.mockClear();

    // Screen readers get a "Report the option at …" action on the other member's option title only.
    expect(screen.getByTestId('option-title-opt1')).toHaveProp('accessibilityActions', [{ name: 'report', label: 'Report the option at Dokk1' }]);
    expect(screen.getByTestId('option-title-opt2')).not.toHaveProp('accessibilityActions', expect.anything());
    await fireEvent(screen.getByTestId('option-title-opt1'), 'accessibilityAction', { nativeEvent: { actionName: 'report' } });
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/sheets/report', params: { podId: POD_ID, optionId: 'opt1' } });
    mockRouter.push.mockClear();
    await fireEvent(screen.getByTestId('option-opt2'), 'longPress');
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('after the plan locks, says voting closed and which time won, shows the plan with the map link, and who is coming', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const meetupAt = Date.now() + 3 * DAY_MS;
    mockCard = { state: 'scheduled', myStatus: 'accepted', themeLabel: 'Brætspil', themeSensitive: false };
    mockPod = {
      state: 'scheduled',
      memberUids: ['me', 'anna', 'bo', 'cy'],
      roster: { me: { firstName: 'Mia', photoV: null }, anna: { firstName: 'Anna', photoV: null }, bo: { firstName: 'Bo', photoV: null }, cy: { firstName: 'Cy', photoV: null } },
      planning: { deadline: ts(meetupAt - DAY_MS), meetupAt: ts(meetupAt), place, winningOptionId: 'opt1', planLockedAt: ts(meetupAt - DAY_MS) },
      attendance: { me: 'coming', anna: 'coming', bo: 'coming', cy: 'unconfirmed' },
    };
    // A vote from someone who has left does not count.
    mockOptions = [option('opt1', 'anna', { me: 'yes', anna: 'yes', bo: 'yes', gone: 'yes', cy: 'no' })];
    await renderPlan();
    expect(screen.getByTestId('plan-locked-status')).toHaveTextContent('Voting has closed: this time won with 3 yes votes. Your yes counts as “I\'m coming”.');
    expect(screen.getByText('Dokk1 · Hack Kampmanns Plads 2, Aarhus')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('open-map'));
    expect(openURL).toHaveBeenCalledWith(place.mapUrl);
    expect(screen.getByTestId('add-to-calendar')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('safety-tips'));
    expect(mockRouter.push).toHaveBeenLastCalledWith('/info/safety');
    // The viewer's own answer, and the others with theirs.
    expect(screen.getByText("You're coming.")).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: "Cy hasn't confirmed" })).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Anna, Coming' })).toBeOnTheScreen();
    openURL.mockRestore();
  });

  it('after the meetup, the locked plan is a record: no map, safety or calendar, and no "your yes" once you cancelled', async () => {
    const meetupAt = Date.now() - DAY_MS;
    mockCard = { state: 'happened', myStatus: 'accepted', themeLabel: 'Brætspil', themeSensitive: false };
    mockPod = {
      state: 'happened',
      memberUids: ['me', 'anna'],
      roster: { me: { firstName: 'Mia', photoV: null }, anna: { firstName: 'Anna', photoV: null } },
      planning: { deadline: ts(meetupAt - DAY_MS), meetupAt: ts(meetupAt), place, winningOptionId: 'opt1' },
    };
    mockOptions = [option('opt1', 'anna', { me: 'yes', anna: 'yes' })];
    await renderPlan();
    expect(screen.getByTestId('plan-locked-status')).toHaveTextContent('Voting has closed: this time won with 2 yes votes.');
    expect(screen.getByText('Dokk1 · Hack Kampmanns Plads 2, Aarhus')).toBeOnTheScreen();
    expect(screen.queryByTestId('open-map')).toBeNull();
    expect(screen.queryByTestId('add-to-calendar')).toBeNull();
    expect(screen.queryByTestId('attendance-cant')).toBeNull();
    client.clear();

    // Scheduled, but the viewer said "Can't make it" after voting yes: the vote no longer counts as coming.
    mockCard = { state: 'scheduled', myStatus: 'accepted', themeLabel: 'Brætspil', themeSensitive: false };
    mockPod = { ...mockPod, state: 'scheduled', planning: { deadline: ts(Date.now()), meetupAt: ts(Date.now() + 2 * DAY_MS), place, winningOptionId: 'opt1' }, attendance: { me: 'notComing', anna: 'coming' } };
    mockOptions = [option('opt1', 'anna', { me: 'yes', anna: 'yes', bo: 'yes' })];
    await renderPlan();
    expect(screen.getByTestId('plan-locked-status')).toHaveTextContent(/^Voting has closed: this time won with 2 yes votes\.$/);
    expect(screen.getByText('You said you can\'t make it.')).toBeOnTheScreen();
  });
});
