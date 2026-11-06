import { DAY_MS, googleMapsPlaceUrl, proposeOptionInput, toLocal, voteOptionInput } from '@grouper/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';
import Plan from '../app/pod/[podId]/plan';

const POD_ID = 'abcdefghijklmnopqrst';
const HOUR = 3_600_000;
const mockRouter = { push: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({ podId: 'abcdefghijklmnopqrst' }) }));
jest.mock('expo-calendar/legacy', () => ({ createEventInCalendarAsync: jest.fn(async () => ({ action: 'saved' })) }));
jest.mock('@/features/session/SessionProvider', () => ({ useUid: () => 'me' }));

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
async function renderPlan() {
  client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: Infinity } } });
  await render(
    <QueryClientProvider client={client}>
      <Plan />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  mockCall.mockReset();
  mockRouter.push.mockClear();
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

  it('proposes a time and a place picked from Places, in a shape proposeOption accepts', async () => {
    jest.useFakeTimers();
    planning();
    mockCall.mockResolvedValue({ optionId: 'newopt' });
    await renderPlan();
    const day = toLocal(Date.now() + 2 * DAY_MS);
    const ymd = `${day.year}-${String(day.month).padStart(2, '0')}-${String(day.day).padStart(2, '0')}`;
    // Day and Time are pickers (storyboard 3.3): nothing is typed.
    await fireEvent.press(screen.getByTestId('option-date'));
    await fireEvent.press(screen.getByTestId(`day-${ymd}`));
    await fireEvent.press(screen.getByTestId('option-time'));
    await fireEvent.press(screen.getByTestId('time-18:30'));
    expect(screen.getByTestId('option-time')).toHaveAccessibilityValue({ text: '18:30' });

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
    jest.useRealTimers();
  });

  it('offers only days within 14 days and quarter hours from 08:00 to 22:00', async () => {
    planning();
    await renderPlan();
    expect(screen.getByTestId('option-date')).toHaveAccessibilityValue({ text: 'Pick a day' });
    await fireEvent.press(screen.getByTestId('option-date'));
    const days = screen.getAllByTestId(/^day-/);
    expect(days.length).toBeGreaterThanOrEqual(14);
    expect(days.length).toBeLessThanOrEqual(15);
    const later = toLocal(Date.now() + 2 * DAY_MS);
    const ymd = `${later.year}-${String(later.month).padStart(2, '0')}-${String(later.day).padStart(2, '0')}`;
    await fireEvent.press(screen.getByTestId(`day-${ymd}`));
    await fireEvent.press(screen.getByTestId('option-time'));
    const times = screen.getAllByTestId(/^time-/).map((el) => String(el.props.testID).slice(5));
    expect(times[0]).toBe('08:00');
    expect(times[times.length - 1]).toBe('22:00');
    expect(times).toHaveLength(57);
    expect(screen.queryByTestId('time-07:45')).toBeNull();
    expect(screen.queryByTestId('time-22:15')).toBeNull();
  });

  it("reports another member's option, but not one's own", async () => {
    planning();
    mockOptions = [option('opt1', 'anna', {}), option('opt2', 'me', {})];
    await renderPlan();
    expect(screen.getAllByRole('button', { name: /^Report the option at / })).toHaveLength(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Report the option at Dokk1' }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/sheets/report', params: { podId: POD_ID, optionId: 'opt1' } });
  });

  it('after the plan locks, shows it with the map link', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const meetupAt = Date.now() + 3 * DAY_MS;
    mockCard = { state: 'scheduled', myStatus: 'accepted', themeLabel: 'Brætspil', themeSensitive: false };
    mockPod = { state: 'scheduled', planning: { deadline: ts(meetupAt - DAY_MS), meetupAt: ts(meetupAt), place } };
    await renderPlan();
    expect(screen.getByText('Dokk1')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('open-map'));
    expect(openURL).toHaveBeenCalledWith(place.mapUrl);
    expect(screen.getByTestId('add-to-calendar')).toBeOnTheScreen();
    openURL.mockRestore();
  });
});
