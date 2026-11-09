import { leavePodInput, respondToPodInput } from '@grouper/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Alert } from 'react-native';
import WhyThisPod from '../app/sheets/why-this-pod';
import { Colors, POD_PALETTE } from '@/components/theme';
import { cardColor } from '@/features/drop/color';
import { ProposalCard } from '@/features/pods/ProposalCard';
import { podColorFor, type PodColor } from '@/lib/podColor';

const POD_ID = 'abcdefghijklmnopqrst';
const mockRouter = { push: jest.fn(), back: jest.fn() };
const mockParentOptions = jest.fn();
const mockNavigation = { getParent: () => ({ setOptions: mockParentOptions }) };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useNavigation: () => mockNavigation,
  useLocalSearchParams: () => ({ podId: 'abcdefghijklmnopqrst' }),
  Stack: { Screen: () => null },
}));
jest.mock('@/features/session/SessionProvider', () => ({ useUid: () => 'me' }));

const mockCall = jest.fn();
jest.mock('@/firebase/callables', () => ({
  callFunction: (...args: unknown[]) => mockCall(...args),
  toAppError: (e: unknown) => e,
}));

const ts = (ms: number) => ({ toMillis: () => ms });
const reasons = [
  { code: 'THEME', yourWording: 'brætspil' },
  { code: 'AREA', label: 'Aarhus C' },
  { code: 'NEAR_YOU', km: 10 },
  { code: 'ALSO_SHARE', yourWordings: ['kaffe', 'gåture'] },
  { code: 'AGE_SPAN', min: 30, max: 41 },
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
const privateCard = () =>
  card({ themeLabel: 'gravid', themeSensitive: true, ageSpan: undefined, reasons: [{ code: 'THEME', yourWording: 'gravid' }, { code: 'NEAR_YOU', km: 5 }] });
let mockCard: unknown = null;
let mockInterests: unknown[] = [];
jest.mock('@/data/docs', () => ({
  usePodCard: () => ({ data: mockCard, error: null, isLoading: false }),
  useInterests: () => ({ data: mockInterests, error: null, isLoading: false }),
}));

let client: QueryClient;
async function renderWith(ui: ReactElement) {
  client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: Infinity } } });
  await render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}
beforeEach(() => {
  mockInterests = [];
  mockCall.mockReset();
  mockRouter.push.mockClear();
  mockRouter.back.mockClear();
  mockParentOptions.mockClear();
});
afterEach(() => client.clear());

describe('proposal card (§3.2, §3.3; drop-proposal)', () => {
  it('shows theme, size and ages, area and distance, shared interests and empty seats, never names', async () => {
    await renderWith(<ProposalCard podId={POD_ID} card={card()} confirmationMin={4} />);
    expect(screen.getByText('New pod')).toBeOnTheScreen();
    expect(screen.getByText('A pod around')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'brætspil' })).toBeOnTheScreen();
    expect(screen.getByText('5 people, ages 30–41')).toBeOnTheScreen();
    expect(screen.getByText('Near Aarhus C · everyone within about 10 km of you')).toBeOnTheScreen();
    expect(screen.getByText('Some of you also share kaffe and gåture')).toBeOnTheScreen();
    expect(screen.getByText('Names and photos appear when 4 people have said yes.')).toBeOnTheScreen();
    expect(screen.getByText(/^Answer by \w{3} \d{2}:\d{2}$/)).toBeOnTheScreen();
  });

  it('without the confirmation threshold it does not name a number', async () => {
    await renderWith(<ProposalCard podId={POD_ID} card={card()} />);
    expect(screen.getByText('Names and photos appear once the pod is confirmed.')).toBeOnTheScreen();
  });

  it('a private interest shows the private badge, size and area only, and how private interests are protected', async () => {
    await renderWith(<ProposalCard podId={POD_ID} card={privateCard()} confirmationMin={4} />);
    expect(screen.getByText('Private interest')).toBeOnTheScreen();
    expect(screen.getByText('5 people')).toBeOnTheScreen();
    expect(screen.getByText('Near Aarhus C')).toBeOnTheScreen();
    expect(screen.queryByText(/ages/)).toBeNull();
    expect(screen.queryByText(/also share/)).toBeNull();
    expect(screen.queryByText(/km/)).toBeNull();
    expect(screen.queryByText('Why this pod?')).toBeNull();
    expect(screen.getByText(/We show less here on purpose/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('link', { name: 'How private interests are protected' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/info/sensitive-interests');
  });

  it('"I\'m in" calls respondToPod with accept: true', async () => {
    mockCall.mockResolvedValue({ state: 'proposed', acceptedCount: 3 });
    await renderWith(<ProposalCard podId={POD_ID} card={card()} />);
    await fireEvent.press(screen.getByRole('button', { name: "I'm in" }));
    expect(mockCall).toHaveBeenCalledWith('respondToPod', { podId: POD_ID, accept: true });
    expect(respondToPodInput.safeParse(mockCall.mock.calls[0]?.[1]).success).toBe(true);
  });

  it('"Not this time" takes an optional reason chip before confirming', async () => {
    mockCall.mockResolvedValue({ state: 'proposed', acceptedCount: 2 });
    await renderWith(<ProposalCard podId={POD_ID} card={card()} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Not this time' }));
    expect(mockCall).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('radio', { name: 'Too far' }));
    expect(screen.getByRole('radio', { name: 'Too far' }).props.accessibilityState).toMatchObject({ checked: true });
    await fireEvent.press(screen.getByRole('button', { name: 'Decline this pod' }));
    expect(mockCall).toHaveBeenCalledWith('respondToPod', { podId: POD_ID, accept: false, reason: 'distance' });
    expect(respondToPodInput.safeParse(mockCall.mock.calls[0]?.[1]).success).toBe(true);
  });

  it('declining without a reason sends none; Cancel goes back to the answer buttons', async () => {
    mockCall.mockResolvedValue({ state: 'proposed', acceptedCount: 2 });
    await renderWith(<ProposalCard podId={POD_ID} card={card()} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Not this time' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: "I'm in" })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Not this time' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Decline this pod' }));
    expect(mockCall).toHaveBeenCalledWith('respondToPod', { podId: POD_ID, accept: false });
  });

  it('after "I\'m in": how many said yes and how many are needed, no answer buttons, Okay and leave (drop-waiting)', async () => {
    const onDone = jest.fn();
    mockCall.mockResolvedValue({ ok: true });
    await renderWith(<ProposalCard podId={POD_ID} card={card({ myStatus: 'accepted', acceptedCount: 3 })} confirmationMin={4} onDone={onDone} />);
    expect(screen.getByText("You're in")).toBeOnTheScreen();
    expect(screen.getByText('3 of 5 said yes')).toBeOnTheScreen();
    // The seats and the "4 needed" bracket are hidden from screen readers; the count says both.
    expect(screen.getByLabelText('3 of 5 said yes. 4 needed.')).toBeOnTheScreen();
    expect(screen.getByText('4 needed', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText(/^Open until /)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: "I'm in" })).toBeNull();
    expect(screen.queryByText('5 people, ages 30–41')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Okay' }));
    expect(onDone).toHaveBeenCalledTimes(1);

    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await fireEvent.press(screen.getByRole('link', { name: 'Changed your mind? Leave this pod' }));
    expect(mockCall).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0]?.[2] ?? [];
    await act(async () => buttons.find((b) => b.style === 'destructive')?.onPress?.());
    expect(mockCall).toHaveBeenCalledWith('leavePod', { podId: POD_ID });
    expect(leavePodInput.safeParse(mockCall.mock.calls[0]?.[1]).success).toBe(true);
    alert.mockRestore();
  });

  it('"Why this pod?" opens the sheet, which renders the server reason codes in the viewer\'s own words', async () => {
    await renderWith(<ProposalCard podId={POD_ID} card={card()} />);
    await fireEvent.press(screen.getByRole('link', { name: 'Why this pod?' }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/sheets/why-this-pod', params: { podId: POD_ID } });

    client.clear();
    mockCard = card();
    await renderWith(<WhyThisPod />);
    expect(screen.getByRole('header', { name: 'Why this pod' })).toBeOnTheScreen();
    expect(screen.getByText('Everyone added brætspil, or something that means the same.')).toBeOnTheScreen();
    expect(screen.getByText('You also share kaffe and gåture with some of them.')).toBeOnTheScreen();
    expect(screen.getByText('Everyone lives about 10 km or less from you, near Aarhus C.')).toBeOnTheScreen();
    expect(screen.getByText("Ages 30–41: everyone is inside everyone else's age range.")).toBeOnTheScreen();
    expect(screen.getByText('You waited 2 weeks, so you got priority this\u00a0time.')).toBeOnTheScreen();
    expect(screen.getByText('What we never use')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('link', { name: 'How matching works' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/info/how-matching-works');
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('the sheet is a bottom sheet over the screen it came from, not a page-height modal (drop-why)', async () => {
    mockCard = card();
    await renderWith(<WhyThisPod />);
    // Its own instance of the sheets group is presented transparently; the sheet paints the dimmed backdrop.
    expect(mockParentOptions).toHaveBeenCalledWith(expect.objectContaining({ presentation: 'transparentModal', contentStyle: { backgroundColor: 'transparent' } }));
    expect(screen.getByTestId('why-this-pod')).toBeOnTheScreen();
  });

  it('while the card loads, the sheet still has its title and a way out', async () => {
    mockCard = undefined;
    await renderWith(<WhyThisPod />);
    expect(screen.getByRole('header', { name: 'Why this pod' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Loading')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('the sheet for a private interest says only what its card carries', async () => {
    mockCard = privateCard();
    await renderWith(<WhyThisPod />);
    expect(screen.getByText('Everyone added gravid, or something that means the same.')).toBeOnTheScreen();
    expect(screen.getByText('Everyone lives about 5 km or less from you.')).toBeOnTheScreen();
    expect(screen.queryByText(/also share/)).toBeNull();
    expect(screen.queryByText(/age range/)).toBeNull();
  });
});

describe('proposal colour (blend decisions 1, 5 and 9)', () => {
  const interest = (display: string, conceptId: string) => ({ id: `i_${conceptId}`, data: { display, norm: display, conceptId, starred: false, createdAt: ts(1) } });

  it('takes the colour from the theme word on the card, whatever concept the viewer holds it under', async () => {
    mockInterests = [interest('brætspil', 'seed_board_games')];
    await renderWith(<ProposalCard podId={POD_ID} card={card()} confirmationMin={4} />);
    expect(screen.getByRole('header', { name: 'brætspil' })).toHaveStyle({ color: POD_PALETTE.tomat.deep });
    client.clear();

    // Another concept, no interests at all: the same word, the same colour.
    mockInterests = [];
    await renderWith(<ProposalCard podId={POD_ID} card={card()} confirmationMin={4} />);
    expect(screen.getByRole('header', { name: 'brætspil' })).toHaveStyle({ color: POD_PALETTE.tomat.deep });
    expect(screen.queryByText('Private interest')).toBeNull();
    client.clear();

    // Another word: its own colour.
    await renderWith(<ProposalCard podId={POD_ID} card={card({ themeLabel: 'sourdough', reasons: [{ code: 'THEME', yourWording: 'sourdough' }] })} confirmationMin={4} />);
    expect(screen.getByRole('header', { name: 'sourdough' })).toHaveStyle({ color: POD_PALETTE.solsikke.deep });
  });

  it('a pod about a private interest has no colour: the name in Ink, the quiet chip, no seats', async () => {
    mockInterests = [interest('gravid', 'seed_board_games')];
    await renderWith(<ProposalCard podId={POD_ID} card={privateCard()} confirmationMin={4} />);
    expect(screen.getByRole('header', { name: 'gravid' })).toHaveStyle({ color: Colors.light.text });
    expect(screen.getByText('Private interest')).toBeOnTheScreen();
    expect(screen.queryByText('You', { includeHiddenElements: true })).toBeNull();
  });

  it('an open-to-anyone pod takes its colour from the pod id', async () => {
    await renderWith(<ProposalCard podId={POD_ID} card={card({ themeLabel: null, reasons: [{ code: 'OPEN_TO_ANYONE' }] })} />);
    const color = podColorFor({ podId: POD_ID }) as PodColor;
    expect(screen.getByRole('header', { name: 'Open to anyone' })).toHaveStyle({ color: POD_PALETTE[color].deep });
  });

  it('cardColor: the word, the pod id for open-to-anyone, private stays quiet', () => {
    expect(cardColor(POD_ID, card())).toBe('tomat');
    expect(cardColor(POD_ID, card({ themeLabel: 'Brætspil ' }))).toBe('tomat');
    expect(cardColor(POD_ID, privateCard())).toBe('private');
    expect(cardColor(POD_ID, card({ themeLabel: null, reasons: [{ code: 'OPEN_TO_ANYONE' }] }))).toBe(podColorFor({ podId: POD_ID }));
    expect(cardColor(POD_ID, card({ reasons: [{ code: 'OPEN_TO_ANYONE' }] }))).toBe(podColorFor({ podId: POD_ID }));
  });
});
