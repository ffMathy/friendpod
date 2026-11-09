import { addInterestsInput } from '@friendpod/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import type * as ReactModule from 'react';
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
type Row = { id: string; data: Record<string, unknown> };
let mockOrdinary: Row[] = [];
let mockSensitive: Row[] = [];
let mockConsent = false;
jest.mock('@/data/docs', () => ({
  useUserDoc: () =>
    live({ area: { areaId: null }, legal: mockConsent ? { art9: { textVersion: 'art9-blanket-en-v2', textSha256: 'x', at: { toMillis: () => 0 } } } : {} }),
  useAreaDoc: () => live(null),
  useInterests: () => live(mockOrdinary),
  useSensitiveInterests: () => live(mockSensitive),
}));

const ordinary = (id: string, display: string, extra: Record<string, unknown> = {}): Row => ({
  id,
  data: { display, starred: false, ...extra },
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
  mockOrdinary = [ordinary('aaaaaaaaaaaaaaaa', 'Brætspil'), ordinary('bbbbbbbbbbbbbbbb', 'Kaffe')];
  mockSensitive = [];
});
afterEach(() => client.clear());

describe('Interests tab (§11)', () => {
  it('shows "n of 20" and removes an interest from its "…"', async () => {
    mockCall.mockResolvedValue({ ok: true });
    await renderTab();
    expect(screen.getByText('2 of 20')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Remove Kaffe' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'More for Kaffe' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Remove Kaffe' }));
    expect(mockCall).toHaveBeenCalledWith('removeInterest', { interestId: 'bbbbbbbbbbbbbbbb' });
  });

  it('stars and unstars, up to 3', async () => {
    mockCall.mockResolvedValue({ ok: true });
    await renderTab();
    expect(screen.getByRole('togglebutton', { name: 'Star Brætspil' }).props.accessibilityState).toMatchObject({ checked: false });
    await fireEvent.press(screen.getByRole('togglebutton', { name: 'Star Brætspil' }));
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
    expect(screen.getByRole('togglebutton', { name: 'Star A' }).props.accessibilityState).toMatchObject({ checked: true });
    await fireEvent.press(screen.getByRole('togglebutton', { name: 'Star D' }));
    expect(mockCall).not.toHaveBeenCalled();
    expect(screen.getByText('You can star up to 3 interests.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('togglebutton', { name: 'Star A' }));
    expect(mockCall).toHaveBeenCalledWith('updateInterest', { interestId: 'aaaaaaaaaaaaaaaa', starred: false });
  });

  it('offers "Did you mean" from the server and confirms the suggestion', async () => {
    mockCall
      .mockResolvedValueOnce({ results: [{ status: 'added', interestId: 'eeeeeeeeeeeeeeee', suggestion: { conceptId: 'c_boardgames01', label: 'brætspil' } }] })
      .mockResolvedValueOnce({ ok: true });
    await renderTab();
    await add('braetspil');
    expect(screen.getByText(/^Did you mean brætspil by “braetspil”\? Saying yes puts you with more people\.$/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Yes, same thing' }));
    expect(mockCall).toHaveBeenLastCalledWith('confirmSuggestion', { interestId: 'eeeeeeeeeeeeeeee', conceptId: 'c_boardgames01' });
    expect(screen.queryByText(/^Did you mean/)).toBeNull();
  });

  it('"No, keep it" keeps the own wording and sends nothing', async () => {
    mockCall.mockResolvedValueOnce({
      results: [{ status: 'added', interestId: 'eeeeeeeeeeeeeeee', suggestion: { conceptId: 'c_boardgames01', label: 'brætspil' } }],
    });
    await renderTab();
    await add('braetspil');
    await fireEvent.press(screen.getByRole('button', { name: 'No, keep it' }));
    expect(mockCall).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/^Did you mean/)).toBeNull();
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

  it('an interest made ordinary ("This isn\'t sensitive for me") keeps "Keep this private" at hand', async () => {
    mockConsent = true;
    mockOrdinary = [ordinary('aaaaaaaaaaaaaaaa', 'Far på barsel', { notSensitiveForMe: true })];
    mockCall.mockResolvedValue({ ok: true });
    await renderTab();
    expect(screen.getByRole('button', { name: 'Keep this private' })).toBeOnTheScreen();
    // The pill takes the place of "…" (priv-interests); the interest's name opens the row's actions instead.
    expect(screen.getAllByRole('button', { name: 'More for Far på barsel' })).toHaveLength(1);
    await fireEvent.press(screen.getByRole('button', { name: 'More for Far på barsel' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Remove Far på barsel' }));
    expect(mockCall).toHaveBeenCalledWith('removeInterest', { interestId: 'aaaaaaaaaaaaaaaa' });
  });

  it('without consent, the private card is "Off" and carries the standing notice in full (PRIVACY §3.2)', async () => {
    await renderTab();
    expect(within(screen.getByTestId('private-interests-off')).getByText('Off')).toBeOnTheScreen();
    expect(within(screen.getByTestId('private-interests-off')).getByText(/^Tip: interests that say something about your health/)).toBeOnTheScreen();
    expect(screen.queryByRole('link', { name: 'How private interests work' })).toBeNull();
  });

  it('with consent, the notice is one line under the lists that opens it on the info page', async () => {
    mockConsent = true;
    await renderTab();
    expect(screen.queryByText(/^Tip: interests that say something about your health/)).toBeNull();
    await fireEvent.press(screen.getByRole('link', { name: 'How private interests work' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/info/sensitive-interests');
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
    // The private card says the consent is off and links to it.
    await fireEvent.press(screen.getByRole('link', { name: 'Agree to sensitive interests' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/settings/sensitive-consent');
  });

  it('lists private interests with their consent date; "Remove & withdraw" withdraws that one in a tap (PRIVACY §3.5)', async () => {
    mockConsent = true;
    mockCall.mockResolvedValue({ ok: true });
    mockSensitive = [{ id: 'pppppppppppppppp', data: { display: 'Gravid', starred: false, consentedAt: { toMillis: () => Date.UTC(2026, 10, 4, 19, 15) } } }];
    await renderTab();
    expect(screen.getByText('3 of 20')).toBeOnTheScreen();
    expect(screen.getByLabelText('Gravid, private')).toBeOnTheScreen();
    expect(screen.getByText('Consent given 4 Nov 2026')).toBeOnTheScreen();
    expect(screen.getByText('Only used to form pods about this interest. Never on a profile, never in a notification.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Remove Gravid and withdraw consent for it' }));
    expect(mockCall).toHaveBeenCalledWith('removeInterest', { interestId: 'pppppppppppppppp' });
  });

  it('"This isn\'t sensitive for me" on a private interest resends it with that flag', async () => {
    mockConsent = true;
    mockCall.mockResolvedValue({ results: [{ status: 'madeOrdinary', interestId: 'pppppppppppppppp' }] });
    mockSensitive = [{ id: 'pppppppppppppppp', data: { display: 'Gravid', starred: false, consentedAt: { toMillis: () => 0 } } }];
    await renderTab();
    await fireEvent.press(screen.getByRole('button', { name: "This isn't sensitive for me" }));
    await act(async () => {
      await Promise.resolve();
    });
    const input = mockCall.mock.calls[0]?.[1] as { items: Record<string, unknown>[] };
    expect(input.items[0]).toMatchObject({ text: 'Gravid', notSensitiveForMe: true });
  });
});
