import { useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Spacing } from '@/components/theme';

/** The vertical rhythm of a page whose actions are pinned under a scrolling body (storyboard 5.4, Delete account). */
export interface FooterFitSpacing {
  /** Above the first block, under the status bar. */
  readonly top: number;
  /** Between the scrolling blocks. */
  readonly gap: number;
  /** Under the last scrolling block (Screen's footer adds its own 12 above the first pinned block). */
  readonly bottom: number;
  /** Between the pinned blocks. */
  readonly footerGap: number;
}

/**
 * Storyboard 5.4 on its 844-pt canvas: 16 under the safe area and between the blocks, and 16, a spacer and 16 between
 * the last block and the pinned note (here 20 plus the footer's 12, at the least).
 */
export const ROOMY_SPACING: FooterFitSpacing = { top: Spacing.md, gap: Spacing.md, bottom: Spacing.ml, footerGap: Spacing.md };

/**
 * Where that rhythm does not fit (an 829-pt Android phone with three-button navigation leaves 750 pt between the bars;
 * Delete account needs about 788 at the storyboard's spacing): 8 under the status bar as on Welcome, 12 between the
 * blocks, 16 above the pinned note and 8 between the pinned blocks, which gives back 52 pt with three and two gaps.
 */
export const COMPACT_SPACING: FooterFitSpacing = { top: Spacing.sm, gap: Spacing.ms, bottom: Spacing.xs, footerGap: Spacing.sm };

/** Measurements closer than this are equal (layout heights are fractional). */
const EPSILON = 0.5;

export interface FooterFit {
  readonly spacing: FooterFitSpacing;
  /**
   * The body still runs under the pinned footer at the compact spacing (small phones, large text): draw an edge on
   * the footer so the cut reads as scrolling, not as a broken control.
   */
  readonly overflowing: boolean;
  /** For the body's ScrollView: its viewport. */
  readonly onLayout: (e: LayoutChangeEvent) => void;
  /** For the body's ScrollView: its content. The content container must not grow (no flexGrow), or the slack is lost. */
  readonly onContentSizeChange: (width: number, height: number) => void;
}

/**
 * Keeps a pinned footer from cutting through the scrolling body at first render: the storyboard's spacing where the
 * body and the footer fit the screen together, else the compact one. `bodyGaps` and `footerGaps` count the gaps between
 * the blocks; keep them fixed by grouping lines that come and go with the block they belong to. Every measurement is
 * stored as what it would be at the storyboard's spacing, so heights measured at either spacing (even one of each, in
 * the frame after a switch) give the same answer and the layout never flips back and forth.
 */
export function useFooterFit(bodyGaps: number, footerGaps: number): FooterFit {
  const contentExtra = ROOMY_SPACING.top - COMPACT_SPACING.top + bodyGaps * (ROOMY_SPACING.gap - COMPACT_SPACING.gap) + ROOMY_SPACING.bottom - COMPACT_SPACING.bottom;
  const footerExtra = footerGaps * (ROOMY_SPACING.footerGap - COMPACT_SPACING.footerGap);
  // Heights at the storyboard's spacing: the body's content and its viewport (0 until measured).
  const [roomy, setRoomy] = useState({ content: 0, viewport: 0 });
  const isCompact = (r: typeof roomy) => r.content > 0 && r.viewport > 0 && r.content - r.viewport > EPSILON;
  const compact = isCompact(roomy);

  const store = (key: 'content' | 'viewport', measured: (wasCompact: boolean) => number) =>
    setRoomy((prev) => {
      const value = measured(isCompact(prev));
      return Math.abs(prev[key] - value) < 0.01 ? prev : { ...prev, [key]: value };
    });

  return {
    spacing: compact ? COMPACT_SPACING : ROOMY_SPACING,
    // At the compact spacing the content is `contentExtra` shorter and the viewport `footerExtra` taller.
    overflowing: compact && roomy.content - contentExtra - (roomy.viewport + footerExtra) > EPSILON,
    onLayout: (e) => {
      const { height } = e.nativeEvent.layout;
      store('viewport', (wasCompact) => height - (wasCompact ? footerExtra : 0));
    },
    onContentSizeChange: (_width, height) => store('content', (wasCompact) => height + (wasCompact ? contentExtra : 0)),
  };
}
