import { addInterestsInput } from '@grouper/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type * as ReactModule from 'react';
import { Colors } from '@/components/theme';
import { InterestManager } from '@/features/interests/InterestManager';

const mockRouter = { push: jest.fn() };
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof ReactModule>('react');
  return { useRouter: () => mockRouter, useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]) };
});

const mockCall = jest.fn();
jest.mock('@/firebase/callables', () => ({
  callFunction: (...args: unknown[]) => mockCall(...args),
  toAppError: (e: unknown) => e,
}));

const live = (data: unknown) => ({ data, error: null, isLoading: false });
const ts = (ms: number) => ({ toMillis: () => ms });
type Row = { id: string; data: Record<string, unknown> };
let mockOrdinary: Row[] = [];
let mockConsent = false;
let mockSensitive: Row[] = [];
jest.mock('@/data/docs', () => ({
  useUserDoc: () =>
    live({ area: { areaId: null }, legal: mockConsent ? { art9: { textVersion: 'art9-blanket-en-v1', textSha256: 'x', at: { toMillis: () => 0 } } } : {} }),
  useAreaDoc: () => live(null),
  useInterests: () => live(mockOrdinary),
  useSensitiveInterests: () => live(mockSensitive),
}));

const ordinary = (id: string, display: string, extra: Record<string, unknown> = {}): Row => ({
  id,
  data: { display, starred: false, state: 'active', ...extra },
});

let client: QueryClient;
async function renderTab() {
  client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: Infinity } } });
  await render(
    <QueryClientProvider client={client}>
      <InterestManager uid="me" locale="en" mode="full" />
    </QueryClientProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
}
async function add(text: string) {
  await fireEvent.changeText(screen.getByLabelText('Add an interest in your own words'), text);
  await fireEvent.press(screen.getByTestId('interest-add'));
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  mockCall.mockReset();
  mockRouter.push.mockClear();
  mockConsent = false;
  mockSensitive = [];
  mockOrdinary = [ordinary('aaaaaaaaaaaaaaaa', 'Brætspil'), ordinary('bbbbbbbbbbbbbbbb', 'Kaffe')];
});
afterEach(() => client.clear());

describe('Interests tab (§11)', () => {
  it('removes an interest', async () => {
    mockCall.mockResolvedValue({ ok: true });
    await renderTab();
    await fireEvent.press(screen.getByRole('button', { name: 'More for Kaffe' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Remove' }));
    expect(mockCall).toHaveBeenCalledWith('removeInterest', { interestId: 'bbbbbbbbbbbbbbbb' });
  });

  it('stars and unstars, up to 3', async () => {
    mockCall.mockResolvedValue({ ok: true });
    await renderTab();
    await fireEvent.press(screen.getAllByRole('switch', { name: 'Star' })[0]!);
    expect(mockCall).toHaveBeenCalledWith('updateInterest', { interestId: 'aaaaaaaaaaaaaaaa', starred: true });
    client.clear();
    mockCall.mockClear();

    mockOrdinary = [
      ordinary('aaaaaaaaaaaaaaaa', 'A', { starred: true }),
      ordinary('bbbbbbbbbbbbbbbb', 'B', { starred: true }),
      ordinary('cccccccccccccccc', 'C', { starred: true }),
      ordinary('dddddddddddddddd', 'D'),
    ];
    await renderTab();
    await fireEvent.press(screen.getAllByRole('switch', { name: 'Star' })[3]!);
    expect(mockCall).not.toHaveBeenCalled();
    expect(screen.getByText('You can star up to 3 interests.')).toBeOnTheScreen();
    await fireEvent.press(screen.getAllByRole('switch', { name: 'Star' })[0]!);
    expect(mockCall).toHaveBeenCalledWith('updateInterest', { interestId: 'aaaaaaaaaaaaaaaa', starred: false });
  });

  it('offers "Did you mean" from the server and confirms the suggestion', async () => {
    mockCall
      .mockResolvedValueOnce({ results: [{ status: 'added', interestId: 'eeeeeeeeeeeeeeee', suggestion: { conceptId: 'c_boardgames01', label: 'brætspil' } }] })
      .mockResolvedValueOnce({ ok: true });
    await renderTab();
    await add('braetspil');
    const sentence = 'Did you mean brætspil by “braetspil”? Saying yes puts you with more people.';
    expect(screen.getByText(sentence)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Yes, same thing' }));
    expect(mockCall).toHaveBeenLastCalledWith('confirmSuggestion', { interestId: 'eeeeeeeeeeeeeeee', conceptId: 'c_boardgames01' });
    expect(screen.queryByText(sentence)).toBeNull();
  });

  it('"Keep this private" resends the holding with selfFlagPrivate (with consent)', async () => {
    mockConsent = true;
    mockCall.mockResolvedValue({ results: [{ status: 'madePrivate', interestId: 'aaaaaaaaaaaaaaaa', private: true }] });
    await renderTab();
    await fireEvent.press(screen.getByRole('button', { name: 'More for Brætspil' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Keep this private' }));
    await act(async () => {
      await Promise.resolve();
    });
    const input = mockCall.mock.calls[0]?.[1] as { items: Record<string, unknown>[] };
    expect(addInterestsInput.safeParse(input).success).toBe(true);
    expect(input.items[0]).toMatchObject({ text: 'Brætspil', selfFlagPrivate: true });
    expect(input.items[0]).not.toHaveProperty('notSensitiveForMe');
    expect(screen.getByText('This interest is now private.')).toBeOnTheScreen();
  });

  it('"Keep this private" without consent is refused on the phone and sends nothing', async () => {
    await renderTab();
    await fireEvent.press(screen.getByRole('button', { name: 'More for Brætspil' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Keep this private' }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockCall).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Sensitive interests: give consent' })).toBeOnTheScreen();
  });

  it('shows a rescan hold (pendingConsent) with its removal date and a way to the consent', async () => {
    mockOrdinary = [ordinary('ffffffffffffffff', 'Gåture', { state: 'pendingConsent', conceptId: null, pendingUntil: ts(Date.UTC(2026, 10, 20, 12)) })];
    await renderTab();
    expect(screen.getByText(/^This interest may be sensitive, so it is on hold\. Unless you agree to sensitive interests, it is removed on /)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Sensitive interests: give consent' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/settings/sensitive-consent');
  });

  it('shows private holdings in their own group with one-tap "Remove & withdraw" and the consent date', async () => {
    mockConsent = true;
    mockSensitive = [{ id: 'pppppppppppppppp', data: { display: 'Gravid', starred: false, consentedAt: ts(Date.UTC(2026, 10, 4, 12)) } }];
    mockCall.mockResolvedValue({ ok: true });
    await renderTab();
    expect(screen.getByText('Private interests')).toBeOnTheScreen();
    expect(screen.getByLabelText('Gravid, private')).toBeOnTheScreen();
    expect(screen.getByText('Consent given 4 Nov 2026')).toBeOnTheScreen();
        await fireEvent.press(screen.getByRole('button', { name: 'Remove & withdraw: Gravid' }));
    expect(mockCall).toHaveBeenCalledWith('removeInterest', { interestId: 'pppppppppppppppp' });
    expect(screen.getAllByRole('switch', { name: 'Star' })).toHaveLength(3);
  });

  it('keeps "Add" green with an empty field, where it does nothing, and links "Read more" from the notice', async () => {
    await renderTab();
    const addButton = screen.getByTestId('interest-add');
    expect(addButton).toBeDisabled();
    expect(addButton).toHaveStyle({ backgroundColor: Colors.light.primary });
    await fireEvent.press(addButton);
    expect(mockCall).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('link', { name: 'Read more about sensitive interests' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/info/sensitive-interests');
  });

  it('"No, keep it" dismisses the suggestion without a call', async () => {
    mockCall.mockResolvedValueOnce({ results: [{ status: 'added', interestId: 'eeeeeeeeeeeeeeee', suggestion: { conceptId: 'c_boardgames01', label: 'brætspil' } }] });
    await renderTab();
    await add('braetspil');
    await fireEvent.press(screen.getByRole('button', { name: 'No, keep it' }));
    expect(mockCall).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Yes, same thing' })).toBeNull();
  });
});
