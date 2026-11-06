import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import WhyThisPod from '../app/sheets/why-this-pod';
import { AvatarFills } from '@/components/theme';
import { PodRow } from '@/features/drop/PodRow';
import { ProposalCard } from '@/features/pods/ProposalCard';

const POD_ID = 'abcdefghijklmnopqrst';
const mockRouter = { push: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({ podId: 'abcdefghijklmnopqrst' }) }));
jest.mock('@/features/session/SessionProvider', () => ({ useUid: () => 'me' }));
jest.mock('@/firebase/callables', () => ({ callFunction: jest.fn(), toAppError: (e: unknown) => e }));

const ts = (ms: number) => ({ toMillis: () => ms });
function card(over: Record<string, unknown> = {}) {
  return {
    state: 'proposed',
    myStatus: 'invited',
    themeLabel: 'brætspil',
    themeSensitive: false,
    sizeTarget: 5,
    acceptedCount: 2,
    acceptBy: ts(Date.now() + 86_400_000),
    reasons: [
      { code: 'THEME', yourWording: 'brætspil' },
      { code: 'NEAR_YOU', km: 10 },
    ],
    areaLabel: 'Aarhus C',
    ...over,
  } as never;
}
// Five members: hashing the uids would give two of them one colour; the pod colours never repeat.
const mockPod = {
  state: 'planning',
  memberUids: ['me', 'u-sofie', 'u-emil', 'u-freja', 'u-mads'],
  roster: {
    me: { firstName: 'Anna', photoV: null },
    'u-sofie': { firstName: 'Sofie', photoV: null },
    'u-emil': { firstName: 'Emil', photoV: null },
    'u-freja': { firstName: 'Freja', photoV: null },
    'u-mads': { firstName: 'Mads', photoV: null },
  },
  planning: { deadline: ts(Date.now() + 86_400_000) },
};
let mockCard: unknown = null;
jest.mock('@/data/docs', () => ({
  usePodCard: () => ({ data: mockCard, error: null, isLoading: false }),
  usePod: () => ({ data: mockPod, error: null, isLoading: false }),
}));

let client: QueryClient;
async function renderWith(ui: ReactElement) {
  client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: Infinity } } });
  await render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}
beforeEach(() => {
  mockRouter.push.mockClear();
  mockRouter.back.mockClear();
});
afterEach(() => client.clear());

const style = (el: { props: { style?: unknown } }) => StyleSheet.flatten(el.props.style as never) ?? {};

describe('proposal card (2.2, 2.4)', () => {
  it('the answer pills grow from their label widths, 1 : 1.4, instead of a fixed split', async () => {
    await renderWith(<ProposalCard podId={POD_ID} card={card()} />);
    const no = screen.getByRole('button', { name: 'Not this time' });
    const yes = screen.getByRole('button', { name: "I'm in" });
    expect(style(no).flexBasis).toBeUndefined();
    expect(style(no.parent as never)).toMatchObject({ flexGrow: 1, flexShrink: 1 });
    expect(style(yes.parent as never)).toMatchObject({ flexGrow: 1.4, flexShrink: 1 });
  });

  it('"Why this pod?" is underlined and shows only while invited', async () => {
    await renderWith(<ProposalCard podId={POD_ID} card={card()} />);
    const why = screen.getByRole('link', { name: 'Why this pod?' });
    expect(screen.getByText('Why this pod?')).toHaveStyle({ textDecorationLine: 'underline' });
    await fireEvent.press(why);
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/sheets/why-this-pod', params: { podId: POD_ID } });
  });

  it('after accepting: the note ends with "Okay", which folds it away; leave stays, underlined and muted', async () => {
    await renderWith(<ProposalCard podId={`${POD_ID}-ok`} card={card({ myStatus: 'accepted', acceptedCount: 3 })} confirmationMin={4} />);
    expect(screen.queryByRole('link', { name: 'Why this pod?' })).toBeNull();
    expect(screen.getByText(/We'll let you know the moment the pod is confirmed/)).toBeOnTheScreen();
    expect(screen.getByText('Changed your mind? Leave this pod')).toHaveStyle({ textDecorationLine: 'underline' });
    await fireEvent.press(screen.getByRole('button', { name: 'Okay' }));
    expect(screen.queryByRole('button', { name: 'Okay' })).toBeNull();
    expect(screen.queryByText(/We'll let you know the moment the pod is confirmed/)).toBeNull();
    expect(screen.getByText('3 of 5 said yes')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Changed your mind? Leave this pod' })).toBeOnTheScreen();
  });
});

describe('Why this pod sheet (2.3)', () => {
  // The fitted form sheet and its dimmed backdrop (a tap on it closes the sheet) are native (app/_layout.tsx).
  it('a bottom sheet that closes from its × button, with light status-bar icons and no extra caption', async () => {
    const push = jest.spyOn(StatusBar, 'pushStackEntry');
    mockCard = card();
    await renderWith(<WhyThisPod />);
    expect(screen.getByText('Everyone added brætspil, or something that means the same.')).toBeOnTheScreen();
    expect(screen.queryByText('Pods are formed automatically.')).toBeNull();
    expect(push).toHaveBeenCalledWith(expect.objectContaining({ barStyle: 'light-content' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole('link', { name: 'How matching works' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/info/how-matching-works');
    push.mockRestore();
  });
});

describe('pod rows (2.1, Pods tab)', () => {
  it('give each other member their pod colour, as on the pod page', async () => {
    await renderWith(<PodRow uid="me" podId={POD_ID} card={card({ state: 'planning', myStatus: 'accepted' })} onPress={jest.fn()} />);
    const bgOf = (initial: string) => {
      let node = screen.getByText(initial, { includeHiddenElements: true }).parent;
      while (node && !style(node as never).backgroundColor) node = node.parent;
      return style(node as never).backgroundColor;
    };
    expect([bgOf('S'), bgOf('E'), bgOf('F')]).toEqual([AvatarFills[0].bg, AvatarFills[1].bg, AvatarFills[2].bg]);
  });
});
