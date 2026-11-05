import { submitFeedbackInput } from '@grouper/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import Feedback from '../app/pod/[podId]/feedback';

const POD_ID = 'abcdefghijklmnopqrst';
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }), useLocalSearchParams: () => ({ podId: 'abcdefghijklmnopqrst' }) }));
jest.mock('@/features/session/SessionProvider', () => ({ useUid: () => 'me' }));

const live = (data: unknown) => ({ data, error: null, isLoading: false });
jest.mock('@/data/docs', () => ({
  usePodCard: () => live({ state: 'happened', myStatus: 'accepted' }),
  usePod: () =>
    live({
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
  it('"Who was there?" starts with every other member ticked', async () => {
    await renderFeedback();
    expect(screen.getByText('Who was there?')).toBeOnTheScreen();
    for (const uid of ['anna', 'bo', 'carl']) expect(screen.getByTestId(`there-${uid}`)).toBeChecked();
    expect(screen.queryByTestId('there-me')).toBeNull();
  });

  it('sends only the unticked members as notThere, and meet-again answers for people who were there', async () => {
    mockCall.mockResolvedValue({ ok: true });
    await renderFeedback();
    expect(screen.getByText(/after 4 weeks instead of 6 months/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('there-bo'));
    expect(screen.getByTestId('there-bo')).not.toBeChecked();
    expect(screen.queryByText('Meet Bo again?')).toBeNull();

    const yes = screen.getAllByRole('switch', { name: 'Yes' });
    const no = screen.getAllByRole('switch', { name: 'No' });
    // [0] is "Did you meet?"; then Anna's and Carl's meet-again answers.
    await fireEvent.press(yes[1]!);
    await fireEvent.press(no[2]!);
    await fireEvent.press(screen.getByRole('switch', { name: 'Keep pod' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Send' }));
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

  it('sends a rating with Keep pod, and "Not for me" when they did not meet', async () => {
    mockCall.mockReset();
    mockCall.mockResolvedValue({ ok: true });
    await renderFeedback();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('switch', { name: '4' }));
    await fireEvent.press(screen.getByRole('switch', { name: 'Keep pod' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Send' }));
    expect(submitFeedbackInput.parse(mockCall.mock.calls[0]?.[1])).toEqual({ podId: POD_ID, met: true, notThere: [], meetAgain: {}, rating: 4, keep: true });
    client.clear();
    mockCall.mockClear();

    await renderFeedback();
    // [0] "Yes", [1] "No" of "Did you meet?"
    await fireEvent.press(screen.getAllByRole('switch', { name: 'No' })[0]!);
    expect(screen.queryByText('Who was there?')).toBeNull();
    await fireEvent.press(screen.getByRole('switch', { name: 'Not for me' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Send' }));
    expect(submitFeedbackInput.parse(mockCall.mock.calls[0]?.[1])).toEqual({ podId: POD_ID, met: false, notThere: [], meetAgain: {}, keep: false });
  });
});
