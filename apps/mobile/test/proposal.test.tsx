import { respondToPodInput } from '@grouper/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import WhyThisPod from '../app/sheets/why-this-pod';
import { ProposalCard } from '@/features/pods/ProposalCard';

const POD_ID = 'abcdefghijklmnopqrst';
const mockRouter = { push: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({ podId: 'abcdefghijklmnopqrst' }) }));
jest.mock('@/features/session/SessionProvider', () => ({ useUid: () => 'me' }));

const mockCall = jest.fn();
jest.mock('@/firebase/callables', () => ({
  callFunction: (...args: unknown[]) => mockCall(...args),
  toAppError: (e: unknown) => e,
}));

const ts = (ms: number) => ({ toMillis: () => ms });
const reasons = [
  { code: 'THEME', yourWording: 'brætspil' },
  { code: 'NEAR_YOU', km: 10 },
  { code: 'ALSO_SHARE', yourWordings: ['kaffe', 'gåture'] },
  { code: 'PRIORITY', weeks: 2 },
];
function card(over: Record<string, unknown> = {}) {
  return {
    state: 'proposed',
    myStatus: 'invited',
    themeLabel: 'brætspil',
    themeSensitive: false,
    sizeTarget: 5,
    acceptedCount: 2,
    acceptBy: ts(Date.now() + 86_400_000),
    reasons,
    areaLabel: 'Aarhus C',
    ageSpan: { min: 30, max: 41 },
    ...over,
  } as never;
}
let mockCard: unknown = null;
jest.mock('@/data/docs', () => ({ usePodCard: () => ({ data: mockCard, error: null, isLoading: false }) }));

let client: QueryClient;
async function renderWith(ui: ReactElement) {
  client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: Infinity } } });
  await render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}
beforeEach(() => {
  mockCall.mockReset();
  mockRouter.push.mockClear();
});
afterEach(() => client.clear());

describe('proposal card (§3.2, §3.3)', () => {
  it('shows theme, size, distance, age span and shared interests, never names', async () => {
    await renderWith(<ProposalCard podId={POD_ID} card={card()} />);
    expect(screen.getByText('brætspil')).toBeOnTheScreen();
    expect(screen.getByText('New pod')).toBeOnTheScreen();
    expect(screen.getByText('5 people, ages 30–41')).toBeOnTheScreen();
    expect(screen.getByText('Near Aarhus C · everyone within about 10 km of you')).toBeOnTheScreen();
    expect(screen.getByText('Some of you also share kaffe and gåture')).toBeOnTheScreen();
    expect(screen.getByText('Names and photos appear once the pod is confirmed.')).toBeOnTheScreen();
  });

  it('a sensitive theme is marked private and shows neither age span nor shared interests', async () => {
    await renderWith(<ProposalCard podId={POD_ID} card={card({ themeSensitive: true, ageSpan: undefined, reasons: [{ code: 'NEAR_YOU', km: 5 }] })} />);
    expect(screen.getByText('Private interest')).toBeOnTheScreen();
    expect(screen.getByText('brætspil')).toBeOnTheScreen();
    expect(screen.getByText('5 people')).toBeOnTheScreen();
    expect(screen.queryByText(/ages/)).toBeNull();
    expect(screen.queryByText(/also share/)).toBeNull();
    expect(screen.getByText(/We show less here on purpose/)).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'How private interests are protected' })).toBeOnTheScreen();
  });

  it('"I\'m in" calls respondToPod with accept: true', async () => {
    mockCall.mockResolvedValue({ state: 'proposed', acceptedCount: 3 });
    await renderWith(<ProposalCard podId={POD_ID} card={card()} />);
    await fireEvent.press(screen.getByRole('button', { name: "I'm in" }));
    expect(mockCall).toHaveBeenCalledWith('respondToPod', { podId: POD_ID, accept: true });
    expect(respondToPodInput.safeParse(mockCall.mock.calls[0]?.[1]).success).toBe(true);
  });

  it('Decline takes an optional reason chip before confirming', async () => {
    mockCall.mockResolvedValue({ state: 'proposed', acceptedCount: 2 });
    await renderWith(<ProposalCard podId={POD_ID} card={card()} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Not this time' }));
    expect(mockCall).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('Too far'));
    await fireEvent.press(screen.getByRole('button', { name: 'Decline this pod' }));
    expect(mockCall).toHaveBeenCalledWith('respondToPod', { podId: POD_ID, accept: false, reason: 'distance' });
    expect(respondToPodInput.safeParse(mockCall.mock.calls[0]?.[1]).success).toBe(true);
  });

  it('after accepting, shows how many said yes, the threshold, and no answer buttons', async () => {
    await renderWith(<ProposalCard podId={POD_ID} card={card({ myStatus: 'accepted', acceptedCount: 3 })} confirmationMin={4} />);
    expect(screen.getByText("You're in")).toBeOnTheScreen();
    expect(screen.getByText('3 of 5 said yes')).toBeOnTheScreen();
    expect(screen.getByText('4 needed')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: "I'm in" })).toBeNull();
    expect(screen.getByRole('button', { name: 'Changed your mind? Leave this pod' })).toBeOnTheScreen();
  });

  it('"Why this pod" opens the sheet, which renders the server reason codes in the viewer\'s own words', async () => {
    await renderWith(<ProposalCard podId={POD_ID} card={card()} />);
    await fireEvent.press(screen.getByRole('link', { name: 'Why this pod?' }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/sheets/why-this-pod', params: { podId: POD_ID } });

    client.clear();
    mockCard = card();
    await renderWith(<WhyThisPod />);
    expect(screen.getByText('Why this pod')).toBeOnTheScreen();
    expect(screen.getByText('Everyone added brætspil, or something that means the same.')).toBeOnTheScreen();
    expect(screen.getByText('You waited 2 weeks, so you got priority this time.')).toBeOnTheScreen();
    expect(screen.getByText('You also share kaffe and gåture with some of them.')).toBeOnTheScreen();
    expect(screen.getByText('Everyone lives about 10 km or less from you.')).toBeOnTheScreen();
    expect(screen.getByText('What we never use')).toBeOnTheScreen();
  });
});
