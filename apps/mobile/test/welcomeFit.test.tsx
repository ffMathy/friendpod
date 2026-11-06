// Welcome (storyboard 1.1) fits one 390x844 screen: the hero takes the space the other blocks leave, clamped to 120..220.
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, type ViewStyle } from 'react-native';
import Welcome from '../app/(auth)/index';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }) }));
jest.mock('expo-apple-authentication', () => ({ isAvailableAsync: jest.fn(async () => true), signInAsync: jest.fn() }));
jest.mock('@/features/auth/google', () => ({ signInWithGoogle: jest.fn() }));
jest.mock('@/firebase', () => ({ auth: jest.fn() }));
jest.mock('@react-native-firebase/auth', () => ({ AppleAuthProvider: {}, signInWithCredential: jest.fn(), reauthenticateWithCredential: jest.fn() }));
jest.mock('@/features/account/account', () => ({ signOut: async () => undefined, consumeAccountDeleted: () => false }));

type El = { props: Record<string, unknown>; parent: El | null; children: (El | string)[] };

/** The nearest element at or above `el` that reports its layout. */
function measured(el: El): El {
  for (let n: El | null = el; n; n = n.parent) if (typeof n.props.onLayout === 'function') return n;
  throw new Error('no onLayout above element');
}
function findAll(el: El, pred: (n: El) => boolean, out: El[] = []): El[] {
  if (pred(el)) out.push(el);
  for (const c of el.children) if (typeof c !== 'string') findAll(c, pred, out);
  return out;
}
const styleOf = (el: El) => (StyleSheet.flatten(el.props.style as ViewStyle) ?? {}) as ViewStyle;
/** The hero is hidden from screen readers and is the only such block with a fill and a fixed height. */
function heroHeight(): number {
  const [hero] = findAll(
    screen.root as unknown as El,
    (n) => n.props.importantForAccessibility === 'no-hide-descendants' && styleOf(n).backgroundColor !== undefined && Number(styleOf(n).height) > 50,
  );
  return Number(styleOf(hero!).height);
}
const layout = (el: El, height: number) => fireEvent(el as never, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 342, height } } });

it('sizes the hero from the free space (390x844: 488 pt between the safe area and the pinned buttons)', async () => {
  await render(<Welcome />);
  // Before the first layout pass it renders at the storyboard's 220.
  expect(heroHeight()).toBe(220);
  const root = screen.root as unknown as El;
  const [viewport] = findAll(root, (n) => typeof n.props.onLayout === 'function' && 'contentContainerStyle' in n.props);
  const top = measured(screen.getByLabelText('Grouper') as unknown as El);
  const copy = measured(screen.getByText('18+ only') as unknown as El);
  expect(top).not.toBe(copy);

  await layout(viewport!, 488);
  await layout(top, 42);
  await layout(copy, 220); // English copy: headline 80 + 20 + body 72 + 20 + chip 28
  expect(heroHeight()).toBe(154);
  await layout(copy, 244); // Danish copy: the body runs to four lines
  expect(heroHeight()).toBe(130);
  await layout(copy, 400); // Large text sizes: the hero stops at 120 and the page scrolls
  expect(heroHeight()).toBe(120);
  await layout(viewport!, 900); // Tall phones: capped at the storyboard's 220
  expect(heroHeight()).toBe(220);
});
