// Delete account (storyboard 5.4): the pinned footer never cuts through the scrolling body at first render. On the
// 829-pt Android audit phone (shots4/30-delete.png) it clipped "Download my data first" to 29 of its 48 pt.
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet, type ViewStyle } from 'react-native';
import { Sizes, Spacing, Type } from '@/components/theme';
import { COMPACT_SPACING, ROOMY_SPACING } from '@/features/settings/useFooterFit';
import DeleteAccount from '../app/settings/delete-account';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }) }));
jest.mock('@/features/session/SessionProvider', () => ({ useUid: () => 'me' }));
jest.mock('@/firebase/callables', () => ({ callFunction: jest.fn(), toAppError: (e: unknown) => e }));
jest.mock('@/features/account/account', () => ({ requestDataExport: jest.fn(), deleteAccount: jest.fn() }));
jest.mock('@/features/account/exportDownload', () => ({ downloadExport: jest.fn() }));
jest.mock('@/data/docs', () => ({ useExports: () => ({ data: [], error: null, isLoading: false }) }));

type El = { type: unknown; props: Record<string, unknown>; parent: El | null };
type Styles = Record<string, number | undefined>;
const flat = (style: unknown) => (StyleSheet.flatten(style as ViewStyle) ?? {}) as Styles;
/** A spacing value the screen must set: a missing one fails here instead of turning the sums into NaN. */
function px(s: Styles, key: string): number {
  const v = s[key];
  if (typeof v !== 'number') throw new Error(`style has no numeric ${key}`);
  return v;
}
const total = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

// Block heights at the device's 393-pt width with the English copy (line counts as on the device; the Danish copy
// wraps to as many lines or fewer). Gaps and paddings are read from the rendered tree.
const CARD_LINES = 11; // five bullets: 2 + 2 + 2 + 2 + 3 lines
const BODY = [
  Sizes.touch + Spacing.xs + Type.title.lineHeight, // back chevron, title (one line)
  2 * Type.bodyMd.lineHeight, // lead
  2 + 2 * Spacing.md + Type.section.lineHeight + 10 + CARD_LINES * Type.bodySm.lineHeight + 4 * Spacing.sm, // "What happens"
  Sizes.buttonMd, // "Download my data first"
];
const FOOTER = [2 * Type.caption.lineHeight, Sizes.button, Sizes.buttonMd]; // re-auth note, delete, Cancel

/** Screen's own footer frame around ours (its padding above and below the pinned blocks). */
function pinnedFrame(footer: El): Styles {
  for (let n = footer.parent; n; n = n.parent) if (typeof n.type === 'string') return flat(n.props.style);
  throw new Error('no host view around the footer');
}

/**
 * A small layout engine: one pass lays the screen out in `safeHeight` (between the status and navigation bars) from
 * the rendered spacing and reports the heights to the body's ScrollView, as a device would.
 */
async function pass(safeHeight: number) {
  const body = screen.getByTestId('delete-account-body') as unknown as El;
  const footer = screen.getByTestId('delete-account-footer') as unknown as El;
  const c = flat(body.props.contentContainerStyle);
  const content = px(c, 'paddingTop') + total(BODY) + (BODY.length - 1) * px(c, 'gap') + px(c, 'paddingBottom');
  const frame = pinnedFrame(footer);
  const pinned =
    px(frame, 'paddingTop') + total(FOOTER) + (FOOTER.length - 1) * px(flat(footer.props.style), 'gap') + px(frame, 'paddingBottom');
  const viewport = safeHeight - pinned;
  await fireEvent(body as never, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 393, height: viewport } } });
  await fireEvent(body as never, 'contentSizeChange', 393, content);
  return { content, viewport };
}

/** Passes until the heights stop changing (the first frames after a spacing switch). */
async function layOut(safeHeight: number) {
  let last = await pass(safeHeight);
  for (let i = 0; i < 4; i++) {
    const next = await pass(safeHeight);
    if (next.content === last.content && next.viewport === last.viewport) return next;
    last = next;
  }
  throw new Error('the layout did not settle');
}

const spacingNow = () => {
  const c = flat((screen.getByTestId('delete-account-body') as unknown as El).props.contentContainerStyle);
  return { top: c.paddingTop, gap: c.gap, bottom: c.paddingBottom, footerGap: flat(screen.getByTestId('delete-account-footer').props.style).gap };
};

it('keeps the export button in the scrolling body and the note, delete and Cancel pinned (storyboard 5.4)', async () => {
  await render(<DeleteAccount />);
  const footer = within(screen.getByTestId('delete-account-footer'));
  expect(footer.getByTestId('delete-account')).toBeOnTheScreen();
  expect(footer.getByRole('button', { name: 'Cancel' })).toBeOnTheScreen();
  expect(footer.getByText("To keep your account safe, we'll ask you to sign in again first.")).toBeOnTheScreen();
  const body = within(screen.getByTestId('delete-account-body'));
  expect(body.getByTestId('delete-export')).toBeOnTheScreen();
  expect(body.getByRole('header', { name: 'Delete your account?' })).toBeOnTheScreen();
  // Before the first measurement it renders at the storyboard's spacing.
  expect(spacingNow()).toEqual(ROOMY_SPACING);
});

it('fits the 829-pt Android audit phone (750 pt between the bars) without cutting into the body', async () => {
  await render(<DeleteAccount />);
  const first = await pass(750);
  expect(first.content - first.viewport).toBeGreaterThan(30); // the storyboard's spacing runs ~38 pt under the footer
  const settled = await layOut(750);
  expect(spacingNow()).toEqual(COMPACT_SPACING);
  expect(settled.content).toBeLessThanOrEqual(settled.viewport);
  expect(screen.queryByTestId('delete-account-edge')).toBeNull();
  // Settled: another pass reports the same heights and keeps the spacing.
  await layOut(750);
  expect(spacingNow()).toEqual(COMPACT_SPACING);
});

it("keeps the storyboard's spacing where it fits (a 915-pt phone, 843 between the bars)", async () => {
  await render(<DeleteAccount />);
  const settled = await layOut(843);
  expect(spacingNow()).toEqual(ROOMY_SPACING);
  expect(settled.content).toBeLessThanOrEqual(settled.viewport);
  expect(screen.queryByTestId('delete-account-edge')).toBeNull();
});

it('goes back to the storyboard spacing when the screen grows, and marks the footer edge where nothing fits', async () => {
  await render(<DeleteAccount />);
  await layOut(750);
  expect(spacingNow()).toEqual(COMPACT_SPACING);
  await layOut(843);
  expect(spacingNow()).toEqual(ROOMY_SPACING);

  // A 667-pt phone: even compact, the body scrolls under the footer, so a hairline marks the edge.
  const small = await layOut(647);
  expect(spacingNow()).toEqual(COMPACT_SPACING);
  expect(small.content).toBeGreaterThan(small.viewport);
  expect(screen.getByTestId('delete-account-edge')).toBeOnTheScreen();
});
