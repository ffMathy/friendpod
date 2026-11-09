import { submitFeedbackInput } from '@grouper/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import Feedback from '../app/pod/[podId]/feedback';

const POD_ID = 'abcdefghijklmnopqrst';
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ back: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => ({ podId: 'abcdefghijklmnopqrst' }),
}));
jest.mock('@/features/session/SessionProvider', () => ({ useUid: () => 'me' }));
jest.mock('@/features/photos/AuthenticatedPhoto', () => ({ AuthenticatedPhoto: () => null }));

const live = (data: unknown) => ({ data, error: null, isLoading: false });
jest.mock('@/data/docs', () => ({
  usePodCard: () => live({ state: 'happened', myStatus: 'accepted', themeLabel: 'brætspil', themeSensitive: false, reasons: [] }),
  usePod: () =>
    live({
      theme: { kind: 'concept', conceptId: 'seed_boardgames', sensitive: false },
      memberUids: ['me', 'anna', 'bo', 'carl'],
      roster: {
        me: { firstName: 'Mia', photoV: null },
        anna: { firstName: 'Anna', photoV: null },
        bo: { firstName: 'Bo', photoV: null },
        carl: { firstName: 'Carl', photoV: null },
      },
    }),
}));

const mockCall = jest.fn();
jest.mock('@/firebase/callables', () => ({
  callFunction: (...args: unknown[]) => mockCall(...args),
  toAppError: (e: unknown) => e,
}));

let client: QueryClient;
async function renderFeedback() {
  client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: Infinity } } });
  await render(
    <QueryClientProvider client={client}>
      <Feedback />
    </QueryClientProvider>,
  );
}
afterEach(() => client.clear());

describe('feedback (D9, D15)', () => {
  it('"Who was there?" starts with every other member ticked, and "meet again" starts unanswered', async () => {
    await renderFeedback();
    expect(screen.getByText('How did it go?')).toBeOnTheScreen();
    expect(screen.getByText('Who was there?')).toBeOnTheScreen();
    for (const uid of ['anna', 'bo', 'carl']) {
      expect(screen.getByTestId(`there-${uid}`)).toBeChecked();
      expect(screen.getByTestId(`again-${uid}-yes`)).not.toBeChecked();
      expect(screen.getByTestId(`again-${uid}-no`)).not.toBeChecked();
    }
    expect(screen.queryByTestId('there-me')).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Anna was there' })).toBeChecked();
  });

  it('sends only the unticked members as notThere, and meet-again answers for people who were there', async () => {
    mockCall.mockResolvedValue({ ok: true });
    await renderFeedback();
    expect(screen.getByText(/can be matched again after 4 weeks/)).toBeOnTheScreen();
    // One untick is not a strike: a no-show needs most of the others (DESIGN §4.4).
    expect(screen.getByText(/only counts as a no-show if most of you do/)).toBeOnTheScreen();
    // Bo answered first, then unticked: he was not there, so his answer is not sent.
    await fireEvent.press(screen.getByRole('radio', { name: 'Yes, meet Bo again' }));
    await fireEvent.press(screen.getByTestId('there-bo'));
    expect(screen.getByTestId('there-bo')).not.toBeChecked();
    expect(screen.queryByTestId('again-bo-yes')).toBeNull();

    await fireEvent.press(screen.getByRole('radio', { name: 'Yes, meet Anna again' }));
    await fireEvent.press(screen.getByRole('radio', { name: "No, don't meet Carl again" }));
    expect(screen.getByTestId('again-anna-yes')).toBeChecked();
    // Keep pod sends the answers.
    await fireEvent.press(screen.getByRole('button', { name: 'Keep pod' }));
    await act(async () => {
      await Promise.resolve();
    });
    const [name, input] = mockCall.mock.calls[0] as [string, unknown];
    expect(name).toBe('submitFeedback');
    expect(submitFeedbackInput.parse(input)).toEqual({
      podId: POD_ID,
      met: true,
      notThere: ['bo'],
      meetAgain: { anna: true, carl: false },
      keep: true,
    });
  });

  it('tapping the chosen meet-again answer again clears it (no answer is a valid answer)', async () => {
    mockCall.mockReset();
    mockCall.mockResolvedValue({ ok: true });
    await renderFeedback();
    await fireEvent.press(screen.getByTestId('again-anna-no'));
    expect(screen.getByTestId('again-anna-no')).toBeChecked();
    await fireEvent.press(screen.getByTestId('again-anna-no'));
    expect(screen.getByTestId('again-anna-no')).not.toBeChecked();
    await fireEvent.press(screen.getByRole('button', { name: 'Not for me' }));
    expect(submitFeedbackInput.parse(mockCall.mock.calls[0]?.[1])).toEqual({ podId: POD_ID, met: true, notThere: [], meetAgain: {}, keep: false });
  });

  it('sends a rating with Keep pod; "I wasn\'t there myself" sends no attendance, answers or rating', async () => {
    mockCall.mockReset();
    mockCall.mockResolvedValue({ ok: true });
    await renderFeedback();
    await fireEvent.press(screen.getByRole('radio', { name: '4 of 5' }));
    expect(screen.getByTestId('rating-4')).toBeChecked();
    await fireEvent.press(screen.getByRole('button', { name: 'Keep pod' }));
    expect(submitFeedbackInput.parse(mockCall.mock.calls[0]?.[1])).toEqual({ podId: POD_ID, met: true, notThere: [], meetAgain: {}, rating: 4, keep: true });
    client.clear();
    mockCall.mockClear();

    await renderFeedback();
    await fireEvent.press(screen.getByTestId('there-bo'));
    await fireEvent.press(screen.getByTestId('again-anna-yes'));
    await fireEvent.press(screen.getByTestId('rating-2'));
    await fireEvent.press(screen.getByRole('checkbox', { name: "I wasn't there myself" }));
    expect(screen.queryByTestId('there-anna')).toBeNull();
    expect(screen.queryByText('How was it overall?')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Not for me' }));
    expect(submitFeedbackInput.parse(mockCall.mock.calls[0]?.[1])).toEqual({ podId: POD_ID, met: false, notThere: [], meetAgain: {}, keep: false });
  });
});
