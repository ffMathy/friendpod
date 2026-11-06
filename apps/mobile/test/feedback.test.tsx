import { submitFeedbackInput } from '@grouper/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import Feedback from '../app/pod/[podId]/feedback';
import { Colors, Sizes, Type } from '@/components/theme';

const POD_ID = 'abcdefghijklmnopqrst';
const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack }), useLocalSearchParams: () => ({ podId: 'abcdefghijklmnopqrst' }) }));
jest.mock('@/features/session/SessionProvider', () => ({ useUid: () => 'me' }));
jest.mock('@/features/photos/AuthenticatedPhoto', () => ({ AuthenticatedPhoto: () => null }));

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
const sent = () => submitFeedbackInput.parse(mockCall.mock.calls[0]?.[1]);
/** Every button's accessible name, in screen order. */
const buttonNames = () => screen.getAllByRole('button').map((b) => b.props.accessibilityLabel as string);
beforeEach(() => {
  mockCall.mockReset();
  mockCall.mockResolvedValue({ ok: true });
  mockBack.mockClear();
});
afterEach(() => client.clear());

describe('feedback (D9, D15)', () => {
  it('"Who was there?" starts with every other member ticked, and nothing is answered for them yet', async () => {
    await renderFeedback();
    expect(screen.getByText('How did it go?')).toBeOnTheScreen();
    expect(screen.getByText('Who was there?')).toBeOnTheScreen();
    for (const uid of ['anna', 'bo', 'carl']) {
      expect(screen.getByTestId(`there-${uid}`)).toBeChecked();
      expect(screen.getByTestId(`again-yes-${uid}`)).not.toBeChecked();
      expect(screen.getByTestId(`again-no-${uid}`)).not.toBeChecked();
    }
    expect(screen.getByRole('checkbox', { name: 'Anna was there' })).toBeChecked();
    expect(screen.queryByTestId('there-me')).toBeNull();
  });

  it('sends only the unticked members as notThere, and meet-again answers for people who were there', async () => {
    await renderFeedback();
    expect(screen.getByText(/after 4 weeks instead of 6 months/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('there-bo'));
    expect(screen.getByTestId('there-bo')).not.toBeChecked();
    expect(screen.queryByTestId('again-yes-bo')).toBeNull();

    await fireEvent.press(screen.getByRole('switch', { name: 'Meet Anna again? Yes' }));
    await fireEvent.press(screen.getByTestId('again-no-carl'));
    // Keep pod is the last answer and sends the form.
    await fireEvent.press(screen.getByRole('button', { name: 'Keep pod' }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockCall.mock.calls[0]?.[0]).toBe('submitFeedback');
    expect(sent()).toEqual({ podId: POD_ID, met: true, notThere: ['bo'], meetAgain: { anna: true, carl: false }, keep: true });
    expect(mockBack).toHaveBeenCalled();
  });

  it('a second tap clears a meet-again answer, which then sends no signal', async () => {
    await renderFeedback();
    await fireEvent.press(screen.getByTestId('again-yes-anna'));
    await fireEvent.press(screen.getByTestId('again-yes-anna'));
    await fireEvent.press(screen.getByTestId('again-no-bo'));
    await fireEvent.press(screen.getByTestId('again-yes-bo'));
    await fireEvent.press(screen.getByRole('button', { name: 'Keep pod' }));
    expect(sent()).toEqual({ podId: POD_ID, met: true, notThere: [], meetAgain: { bo: true }, keep: true });
  });

  it('sends a rating with Keep pod, and "Not for me" when they did not meet', async () => {
    await renderFeedback();
    await fireEvent.press(screen.getByRole('switch', { name: '4 of 5' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Keep pod' }));
    expect(sent()).toEqual({ podId: POD_ID, met: true, notThere: [], meetAgain: {}, rating: 4, keep: true });
    client.clear();
    mockCall.mockClear();

    await renderFeedback();
    await fireEvent.press(screen.getByRole('button', { name: "We didn't meet" }));
    expect(screen.queryByText('Who was there?')).toBeNull();
    expect(screen.queryByTestId('rating-4')).toBeNull();
    expect(screen.getByText('Meet this pod again?')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Not for me' }));
    expect(sent()).toEqual({ podId: POD_ID, met: false, notThere: [], meetAgain: {}, keep: false });
  });

  // Audit "feedback-didnt-meet": the link sat between the card and "How was it overall?" as small, muted, left-aligned
  // text with no underline, so it read as a label, not an action, and pushed the storyboard's rating down.
  it('"We didn\'t meet" is a quiet underlined button with a 44-pt row, under Keep pod / Not for me (4.1, 2.4 style)', async () => {
    await renderFeedback();
    const didNotMeet = screen.getByRole('button', { name: "We didn't meet" });
    expect(didNotMeet).toBe(screen.getByTestId('met-no'));
    expect(didNotMeet).toHaveStyle({ minHeight: Sizes.touch, alignSelf: 'center' });
    expect(screen.getByText("We didn't meet")).toHaveStyle({
      fontSize: Type.section.fontSize,
      textDecorationLine: 'underline',
      color: Colors.light.muted,
    });
    // Card, rating and Keep card stay together as drawn; the quiet way out comes last.
    const names = buttonNames();
    expect(names.at(-1)).toBe("We didn't meet");
    expect(names.indexOf("We didn't meet")).toBeGreaterThan(names.indexOf('Not for me'));

    // "We did meet" takes the same spot and brings the questions back.
    await fireEvent.press(didNotMeet);
    expect(screen.getByText("You said you didn't meet, so you won't be asked who was there or how it went.")).toBeOnTheScreen();
    expect(buttonNames().at(-1)).toBe('We did meet');
    expect(screen.getByTestId('met-yes')).toHaveStyle({ minHeight: Sizes.touch, alignSelf: 'center' });
    await fireEvent.press(screen.getByRole('button', { name: 'We did meet' }));
    expect(screen.getByText('Who was there?')).toBeOnTheScreen();
    expect(screen.getByTestId('rating-4')).toBeOnTheScreen();
    expect(screen.getByTestId('there-anna')).toBeChecked();
  });

  // Storyboard 4.1 draws one checkbox per person; §3.6 asks yes / no / skip and the server reads a missing answer as no
  // signal but `false` as "never again". A row left alone must send nothing, so the pair stays.
  it('"Meet again" keeps a third, unanswered state: untouched rows send no "no"', async () => {
    await renderFeedback();
    await fireEvent.press(screen.getByRole('switch', { name: 'Meet Anna again? Yes' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Not for me' }));
    expect(sent().meetAgain).toEqual({ anna: true });
    expect(screen.getByRole('switch', { name: 'Meet Bo again? No' })).not.toBeChecked();
  });
});
