import { addInterestsInput } from '@grouper/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
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
const ts = (ms: number) => ({ toMillis: () => ms });
type Row = { id: string; data: Record<string, unknown> };
let mockOrdinary: Row[] = [];
let mockConsent = false;
jest.mock('@/data/docs', () => ({
  useUserDoc: () =>
    live({ area: { areaId: null }, legal: mockConsent ? { art9: { textVersion: 'art9-blanket-en-v1', textSha256: 'x', at: { toMillis: () => 0 } } } : {} }),
  useAreaDoc: () => live(null),
  useInterests: () => live(mockOrdinary),
  useSensitiveInterests: () => live([]),
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
  mockOrdinary = [ordinary('aaaaaaaaaaaaaaaa', 'Brætspil'), ordinary('bbbbbbbbbbbbbbbb', 'Kaffe')];
});
afterEach(() => client.clear());

describe('Interests tab (§11)', () => {
  it('removes an interest', async () => {
    mockCall.mockResolvedValue({ ok: true });
    await renderTab();
    await fireEvent.press(screen.getAllByRole('button', { name: 'Remove' })[1]!);
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
    expect(screen.getByText('Did you mean “brætspil”?')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Yes, use that' }));
    expect(mockCall).toHaveBeenLastCalledWith('confirmSuggestion', { interestId: 'eeeeeeeeeeeeeeee', conceptId: 'c_boardgames01' });
    expect(screen.queryByText('Did you mean “brætspil”?')).toBeNull();
  });

  it('"Keep this private" resends the holding with selfFlagPrivate (with consent)', async () => {
    mockConsent = true;
    mockCall.mockResolvedValue({ results: [{ status: 'madePrivate', interestId: 'aaaaaaaaaaaaaaaa', private: true }] });
    await renderTab();
    await fireEvent.press(screen.getAllByRole('button', { name: 'Keep this private' })[0]!);
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
    await fireEvent.press(screen.getAllByRole('button', { name: 'Keep this private' })[0]!);
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
});
