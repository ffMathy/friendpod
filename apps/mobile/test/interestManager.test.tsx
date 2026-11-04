import { EMBEDDING_DIM } from '@grouper/core';
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
const ts = { toMillis: () => 0 };
let mockConsent = false;
jest.mock('@/data/docs', () => ({
  useUserDoc: () =>
    live({ area: { areaId: null }, legal: mockConsent ? { art9: { textVersion: 'art9-blanket-en-v1', textSha256: 'x', at: ts } } : {} }),
  useAreaDoc: () => live(null),
  useInterests: () => live([{ id: 'ordinary000000001', data: { display: 'Brætspil', starred: false, state: 'active' } }]),
  useSensitiveInterests: () => live([{ id: 'private0000000001', data: { display: 'Gravid', starred: false } }]),
}));

let client: QueryClient;
async function renderManager() {
  client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: Infinity } } });
  await render(
    <QueryClientProvider client={client}>
      <InterestManager uid="me" locale="en" mode="onboarding" />
    </QueryClientProvider>,
  );
  // The stub embedder loads on focus.
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  mockCall.mockReset();
  mockRouter.push.mockClear();
  mockConsent = false;
});
afterEach(() => client.clear());

describe('InterestManager (D1, D3)', () => {
  it('shows private holdings with a lock and no theme explanation, ordinary ones without', async () => {
    await renderManager();
    expect(screen.getByText('🔒 Gravid')).toBeOnTheScreen();
    expect(screen.getByLabelText('Gravid, private')).toBeOnTheScreen();
    expect(screen.getByText('Brætspil')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: "This isn't sensitive for me" })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Keep this private' })).toBeOnTheScreen();
  });

  it('adds a tag with its on-device vector', async () => {
    mockCall.mockResolvedValue({ results: [{ status: 'added', interestId: 'abcdefghijklmnop' }] });
    await renderManager();
    await fireEvent.changeText(screen.getByLabelText('Add an interest in your own words'), 'Vinterbadning');
    await fireEvent.press(screen.getByTestId('interest-add'));
    await act(async () => {
      await Promise.resolve();
    });
    const [name, input] = mockCall.mock.calls[0] as [string, { items: { text: string; vector: number[] }[] }];
    expect(name).toBe('addInterests');
    expect(input.items[0]?.text).toBe('Vinterbadning');
    expect(input.items[0]?.vector).toHaveLength(EMBEDDING_DIM);
    expect(screen.getByText('Added.')).toBeOnTheScreen();
  });

  it('without consent, refuses a sensitive tag on the phone with a way to the consent', async () => {
    await renderManager();
    await fireEvent.changeText(screen.getByLabelText('Add an interest in your own words'), 'pregnant');
    await fireEvent.press(screen.getByTestId('interest-add'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockCall).not.toHaveBeenCalled();
    expect(screen.getByText(/so we only save it if you've agreed to sensitive interests/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Sensitive interests: give consent' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/sensitive-consent');
  });

  it('with consent, "This isn\'t sensitive for me" resends the holding with that flag', async () => {
    mockConsent = true;
    mockCall.mockResolvedValue({ results: [{ status: 'madeOrdinary', interestId: 'private0000000001' }] });
    await renderManager();
    await fireEvent.press(screen.getByRole('button', { name: "This isn't sensitive for me" }));
    await act(async () => {
      await Promise.resolve();
    });
    const input = mockCall.mock.calls[0]?.[1] as { items: Record<string, unknown>[] };
    expect(input.items[0]).toMatchObject({ text: 'Gravid', notSensitiveForMe: true });
    expect(screen.getByText('Done. We now treat this as an ordinary interest, for you only.')).toBeOnTheScreen();
  });
});
