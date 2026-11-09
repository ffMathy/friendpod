import { EMBEDDING_DIM } from '@grouper/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type * as ReactModule from 'react';
import { POD_PALETTE, Colors } from '@/components/theme';
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
const BRAETSPIL = { id: 'ordinary000000001', data: { display: 'Brætspil', conceptId: 'seed_boardgames', starred: false } };
let mockOrdinary: unknown[] = [BRAETSPIL];
jest.mock('@/data/docs', () => ({
  useUserDoc: () =>
    live({ area: { areaId: null }, legal: mockConsent ? { art9: { textVersion: 'art9-blanket-en-v2', textSha256: 'x', at: ts } } : {} }),
  useAreaDoc: () => live(null),
  useInterests: () => live(mockOrdinary),
  useSensitiveInterests: () => live([{ id: 'private0000000001', data: { display: 'Gravid', starred: false, consentedAt: ts } }]),
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
  mockOrdinary = [BRAETSPIL];
});
afterEach(() => client.clear());

describe('InterestManager (D1, D3)', () => {
  it('shows private holdings as quiet chips with a lock, and offers each change on a tap', async () => {
    await renderManager();
    expect(screen.getByLabelText('Gravid, private')).toBeOnTheScreen();
    expect(screen.getByText('Brætspil')).toBeOnTheScreen();
    expect(screen.getByText('2 added', { exact: false })).toBeOnTheScreen();
    // The standing notice at the field (PRIVACY §3.2), verbatim.
    expect(screen.getByText(/^Tip: interests that say something about your health/)).toBeOnTheScreen();
    expect(screen.getByText("Tap an interest to change whether it's private.")).toBeOnTheScreen();
    // No change is offered until the interest is tapped ("Tap an interest to change that").
    expect(screen.queryByRole('button', { name: "This isn't sensitive for me" })).toBeNull();
    await fireEvent.press(screen.getByLabelText('Gravid, private'));
    expect(screen.getByRole('button', { name: "This isn't sensitive for me" })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Brætspil' }));
    expect(screen.getByRole('button', { name: 'Keep this private' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: "This isn't sensitive for me" })).toBeNull();
  });

  it('removes an interest from its chip', async () => {
    mockCall.mockResolvedValue({ ok: true });
    await renderManager();
    await fireEvent.press(screen.getByRole('button', { name: 'Remove Gravid' }));
    expect(mockCall).toHaveBeenCalledWith('removeInterest', { interestId: 'private0000000001' });
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
    expect(screen.getByText(/so we only save it if you've agreed to sensitive interests\. Nothing was sent or saved\./)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Sensitive interests: give consent' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/sensitive-consent');
  });

  it('when the server refuses for lack of consent, says it was not saved rather than "nothing was sent"', async () => {
    mockCall.mockResolvedValue({ results: [{ status: 'rejected', reasonCode: 'ART9_CONSENT_REQUIRED' }] });
    await renderManager();
    await fireEvent.changeText(screen.getByLabelText('Add an interest in your own words'), 'Vinterbadning');
    await fireEvent.press(screen.getByTestId('interest-add'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockCall).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/We didn't save it\./)).toBeOnTheScreen();
    expect(screen.queryByText(/Nothing was sent/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Sensitive interests: give consent' })).toBeOnTheScreen();
  });

  it('with consent, "This isn\'t sensitive for me" resends the holding with that flag', async () => {
    mockConsent = true;
    mockCall.mockResolvedValue({ results: [{ status: 'madeOrdinary', interestId: 'private0000000001' }] });
    await renderManager();
    await fireEvent.press(screen.getByLabelText('Gravid, private'));
    await fireEvent.press(screen.getByRole('button', { name: "This isn't sensitive for me" }));
    await act(async () => {
      await Promise.resolve();
    });
    const input = mockCall.mock.calls[0]?.[1] as { items: Record<string, unknown>[] };
    expect(input.items[0]).toMatchObject({ text: 'Gravid', notSensitiveForMe: true });
    expect(screen.getByText('Done. We now treat this as an ordinary interest, for you only.')).toBeOnTheScreen();
  });

  it('colours each interest from its own word, and keeps private interests quiet (decisions 1, 9)', async () => {
    mockOrdinary = [
      BRAETSPIL,
      // Another wording of the same concept is another word, so another colour (the founder's accepted trade-off).
      { id: 'ordinary000000002', data: { display: 'board games', conceptId: 'seed_boardgames', starred: false } },
      { id: 'ordinary000000003', data: { display: 'Surdej', conceptId: 'seed_bread_baking', starred: false } },
    ];
    await renderManager();
    const tomat = { backgroundColor: POD_PALETTE.tomat.tint, borderColor: POD_PALETTE.tomat.tintBorder };
    expect(screen.getByTestId('interest-chip-ordinary000000001')).toHaveStyle(tomat);
    expect(screen.getByTestId('interest-chip-ordinary000000002')).toHaveStyle({ backgroundColor: POD_PALETTE.baer.tint });
    expect(screen.getByTestId('interest-chip-ordinary000000003')).toHaveStyle({ backgroundColor: POD_PALETTE.fjord.tint });
    // Private: white with the 1.5 px Ink ring, no tint.
    expect(screen.getByTestId('interest-chip-private0000000001')).toHaveStyle({
      backgroundColor: Colors.light.privateBg,
      borderColor: Colors.light.privateBorder,
      borderWidth: 1.5,
    });
  });

  it('draws an interest dashed while its "Did you mean" is open, then in its colour', async () => {
    mockOrdinary = [BRAETSPIL, { id: 'ordinary000000002', data: { display: 'brætspilsaften', conceptId: 'c_0a1b2c3d4e5f60718293', starred: false } }];
    mockCall.mockResolvedValue({
      results: [{ status: 'added', interestId: 'ordinary000000002', suggestion: { conceptId: 'seed_boardgames', label: 'brætspil' } }],
    });
    await renderManager();
    await fireEvent.changeText(screen.getByLabelText('Add an interest in your own words'), 'brætspilsaften');
    await fireEvent.press(screen.getByTestId('interest-add'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByTestId('interest-chip-ordinary000000002')).toHaveStyle({ borderStyle: 'dashed', backgroundColor: Colors.light.surface });
    await fireEvent.press(screen.getByRole('button', { name: 'No, keep it' }));
    expect(screen.getByTestId('interest-chip-ordinary000000002')).toHaveStyle({ borderStyle: 'solid', backgroundColor: POD_PALETTE.tomat.tint });
  });
});
