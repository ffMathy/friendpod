/**
 * The storyboard icon set, drawn with plain Views (the app has no react-native-svg). Every glyph is the storyboard's
 * 24×24, 2-pt-stroke SVG rebuilt from lines (round caps), rings, arcs, boxes and dots, scaled to `size`.
 *
 *   <Icon name="lock" size={16} color={p.violet} />
 *
 * Icons are decorative by default (hidden from screen readers). Pass `accessibilityLabel` for a standalone icon that
 * carries meaning; inside a labelled button the button's label is enough.
 */
import { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { usePalette } from './theme';

type Line = readonly [x1: number, y1: number, x2: number, y2: number];
type Circle = readonly [cx: number, cy: number, r: number];
type Rect = readonly [x: number, y: number, w: number, h: number, rx: number];
/** A ring clipped to part of itself. */
interface Arc {
  readonly c: Circle;
  readonly part: 'top' | 'bottom' | 'topRight';
}

interface Glyph {
  readonly lines?: readonly Line[];
  readonly rings?: readonly Circle[];
  readonly dots?: readonly Circle[];
  readonly boxes?: readonly Rect[];
  readonly arcs?: readonly Arc[];
  /** A map pin: a rotated square with three rounded corners, centred at (cx, cy) with side s. */
  readonly drop?: readonly [cx: number, cy: number, s: number];
  readonly star?: 'outline' | 'filled';
}

// Star geometry (regular pentagram), centred so its bounding box is centred in the 24 box.
const STAR_R = 9.6;
const STAR_INNER = STAR_R * 0.382;
const STAR_CX = 12;
const STAR_CY = 12 + STAR_R * 0.0955;
const starPoint = (i: number): readonly [number, number] => {
  const outer = i % 2 === 0;
  const angle = ((-90 + i * 36) * Math.PI) / 180;
  const r = outer ? STAR_R : STAR_INNER;
  return [STAR_CX + r * Math.cos(angle), STAR_CY + r * Math.sin(angle)];
};
const STAR_LINES: readonly Line[] = Array.from({ length: 10 }, (_, i) => {
  const [x1, y1] = starPoint(i);
  const [x2, y2] = starPoint((i + 1) % 10);
  return [x1, y1, x2, y2] as const;
});

const GLYPHS = {
  chevronLeft: { lines: [[15, 5, 8, 12], [8, 12, 15, 19]] },
  chevronRight: { lines: [[9, 5, 16, 12], [16, 12, 9, 19]] },
  chevronDown: { lines: [[6, 9, 12, 15], [12, 15, 18, 9]] },
  close: { lines: [[6, 6, 18, 18], [18, 6, 6, 18]] },
  check: { lines: [[5, 12.5, 9.5, 17], [9.5, 17, 19, 7.5]] },
  plus: { lines: [[12, 5, 12, 19], [5, 12, 19, 12]] },
  lock: {
    boxes: [[5, 11, 14, 10, 2]],
    lines: [[8, 11, 8, 8], [16, 8, 16, 11]],
    arcs: [{ c: [12, 8, 4], part: 'top' }],
  },
  info: { rings: [[12, 12, 9]], lines: [[12, 11, 12, 16]], dots: [[12, 8, 1.15]] },
  clock: { rings: [[12, 12, 9]], lines: [[12, 7, 12, 12], [12, 12, 15, 14]] },
  pin: { drop: [12, 10, 14.5], rings: [[12, 10, 2.5]] },
  people: {
    rings: [[9, 8, 3], [17, 9, 2.5]],
    arcs: [{ c: [9, 20, 6], part: 'top' }, { c: [15.5, 20, 5.5], part: 'topRight' }],
  },
  tag: {
    lines: [[3, 12, 3, 4], [3, 4, 11, 4], [11, 4, 21, 14], [21, 14, 13, 22], [13, 22, 3, 12]],
    rings: [[7.5, 7.5, 1.5]],
  },
  calendar: { boxes: [[4, 5, 16, 15, 1]], lines: [[7, 3, 7, 6], [17, 3, 17, 6], [4, 9, 20, 9]] },
  calendarPlus: {
    boxes: [[4, 5, 16, 15, 1]],
    lines: [[7, 3, 7, 6], [17, 3, 17, 6], [4, 9, 20, 9], [12, 12, 12, 17], [9.5, 14.5, 14.5, 14.5]],
  },
  person: { rings: [[12, 8, 4]], arcs: [{ c: [12, 21, 8], part: 'top' }] },
  star: { star: 'outline' },
  starFilled: { star: 'filled' },
  more: { dots: [[5, 12, 1.8], [12, 12, 1.8], [19, 12, 1.8]] },
  search: { rings: [[11, 11, 6]], lines: [[20, 20, 15.5, 15.5]] },
  chat: { lines: [[4, 5, 20, 5], [20, 5, 20, 16], [20, 16, 9, 16], [9, 16, 4, 20], [4, 20, 4, 5]] },
  send: { lines: [[5, 12, 18, 12], [13, 6, 19, 12], [19, 12, 13, 18]] },
  share: { lines: [[12, 15, 12, 3], [7, 8, 12, 3], [12, 3, 17, 8], [5, 13, 5, 20], [5, 20, 19, 20], [19, 20, 19, 13]] },
  download: { lines: [[12, 4, 12, 15], [7, 10, 12, 15], [12, 15, 17, 10], [5, 20, 19, 20]] },
  shield: {
    lines: [
      [12, 3, 19, 6], [19, 6, 19, 12], [19, 12, 17.2, 16.6], [17.2, 16.6, 12, 21],
      [12, 3, 5, 6], [5, 6, 5, 12], [5, 12, 6.8, 16.6], [6.8, 16.6, 12, 21],
    ],
  },
  bell: {
    lines: [[6, 16, 6, 11], [18, 11, 18, 16], [18, 16, 20, 18], [20, 18, 4, 18], [4, 18, 6, 16]],
    arcs: [{ c: [12, 11, 6], part: 'top' }, { c: [12, 20, 2], part: 'bottom' }],
  },
  camera: {
    lines: [[4, 8, 7, 8], [7, 8, 9, 5], [9, 5, 15, 5], [15, 5, 17, 8], [17, 8, 20, 8], [20, 8, 20, 19], [20, 19, 4, 19], [4, 19, 4, 8]],
    rings: [[12, 13, 3.5]],
  },
  block: { rings: [[12, 12, 9]], lines: [[5.6, 5.6, 18.4, 18.4]] },
  flag: { lines: [[5, 21, 5, 4], [5, 4, 16, 4], [16, 4, 14, 8], [14, 8, 16, 12], [16, 12, 5, 12]] },
  pause: { lines: [[9, 5, 9, 19], [15, 5, 15, 19]] },
  trash: { lines: [[4, 7, 20, 7], [9, 7, 9, 4], [9, 4, 15, 4], [15, 4, 15, 7], [6, 7, 7, 20], [7, 20, 17, 20], [17, 20, 18, 7]] },
} as const satisfies Record<string, Glyph>;

export type IconName = keyof typeof GLYPHS;
export const ICON_NAMES = Object.keys(GLYPHS) as IconName[];

export interface IconProps {
  readonly name: IconName;
  /** Box size in points (default 24). The stroke scales with it. */
  readonly size?: number;
  /** Default: the palette's ink. */
  readonly color?: string;
  /** Stroke width in 24-box units (default 2, as in the storyboards). */
  readonly strokeWidth?: number;
  /** Makes the icon an image for screen readers; leave out for decorative icons. */
  readonly accessibilityLabel?: string;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}

export const Icon = memo(function Icon({ name, size = 24, color, strokeWidth = 2, accessibilityLabel, style, testID }: IconProps) {
  const p = usePalette();
  const ink = color ?? p.ink;
  const glyph: Glyph = GLYPHS[name];
  const s = size / 24;
  const sw = strokeWidth * s;
  const a11y = accessibilityLabel
    ? { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel }
    : { accessible: false, accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const };

  return (
    <View testID={testID} pointerEvents="none" style={[{ width: size, height: size }, style]} {...a11y}>
      {glyph.boxes?.map(([x, y, w, h, rx], i) => (
        <View
          key={`b${i}`}
          style={[
            styles.abs,
            {
              left: x * s - sw / 2,
              top: y * s - sw / 2,
              width: w * s + sw,
              height: h * s + sw,
              borderWidth: sw,
              borderRadius: rx * s + sw / 2,
              borderColor: ink,
            },
          ]}
        />
      ))}
      {glyph.rings?.map((c, i) => <Ring key={`r${i}`} c={c} s={s} sw={sw} color={ink} />)}
      {glyph.arcs?.map((arc, i) => {
        const [cx, cy, r] = arc.c;
        const pad = sw / s; // keep the whole stroke inside the clip
        const clip =
          arc.part === 'top'
            ? { x: cx - r - pad, y: cy - r - pad, w: 2 * (r + pad), h: r + pad }
            : arc.part === 'bottom'
              ? { x: cx - r - pad, y: cy, w: 2 * (r + pad), h: r + pad }
              : { x: cx, y: cy - r - pad, w: r + pad, h: r + pad };
        const d = 2 * r * s + sw;
        return (
          <View
            key={`a${i}`}
            style={[styles.abs, styles.clip, { left: clip.x * s, top: clip.y * s, width: clip.w * s, height: clip.h * s }]}
          >
            <View
              style={[
                styles.abs,
                {
                  left: cx * s - d / 2 - clip.x * s,
                  top: cy * s - d / 2 - clip.y * s,
                  width: d,
                  height: d,
                  borderRadius: d / 2,
                  borderWidth: sw,
                  borderColor: ink,
                },
              ]}
            />
          </View>
        );
      })}
      {glyph.drop ? <Drop drop={glyph.drop} s={s} sw={sw} color={ink} /> : null}
      {(glyph.star === 'outline' ? STAR_LINES : (glyph.lines ?? [])).map((l, i) => (
        <Stroke key={`l${i}`} line={l} s={s} sw={sw} color={ink} />
      ))}
      {glyph.star === 'filled' ? <FilledStar s={s} color={ink} /> : null}
      {glyph.dots?.map(([cx, cy, r], i) => (
        <View
          key={`d${i}`}
          style={[styles.abs, { left: (cx - r) * s, top: (cy - r) * s, width: 2 * r * s, height: 2 * r * s, borderRadius: r * s, backgroundColor: ink }]}
        />
      ))}
    </View>
  );
});

/** A line with round caps: a pill as long as the segment plus one stroke, rotated about its midpoint. */
function Stroke({ line: [x1, y1, x2, y2], s, sw, color }: { line: Line; s: number; sw: number; color: string }) {
  const dx = (x2 - x1) * s;
  const dy = (y2 - y1) * s;
  const w = Math.hypot(dx, dy) + sw;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  return (
    <View
      style={[
        styles.abs,
        {
          left: ((x1 + x2) / 2) * s - w / 2,
          top: ((y1 + y2) / 2) * s - sw / 2,
          width: w,
          height: sw,
          borderRadius: sw / 2,
          backgroundColor: color,
          transform: [{ rotate: `${angle}deg` }],
        },
      ]}
    />
  );
}

function Ring({ c: [cx, cy, r], s, sw, color }: { c: Circle; s: number; sw: number; color: string }) {
  const d = 2 * r * s + sw;
  return (
    <View
      style={[
        styles.abs,
        { left: cx * s - d / 2, top: cy * s - d / 2, width: d, height: d, borderRadius: d / 2, borderWidth: sw, borderColor: color },
      ]}
    />
  );
}

function Drop({ drop: [cx, cy, side], s, sw, color }: { drop: readonly [number, number, number]; s: number; sw: number; color: string }) {
  const d = side * s + sw;
  const r = d / 2;
  return (
    <View
      style={[
        styles.abs,
        {
          left: cx * s - r,
          top: cy * s - r,
          width: d,
          height: d,
          borderWidth: sw,
          borderColor: color,
          borderTopLeftRadius: r,
          borderTopRightRadius: r,
          borderBottomLeftRadius: r,
          borderBottomRightRadius: sw / 2,
          transform: [{ rotate: '45deg' }],
        },
      ]}
    />
  );
}

/**
 * A filled pentagram as the union of five triangles, each from an outer point to the inner diagonal opposite it,
 * drawn as border triangles in squares rotated about the star's centre.
 */
function FilledStar({ s, color }: { s: number; color: string }) {
  const R = STAR_R * s;
  const half = 0.363 * R;
  const height = 1.118 * R;
  return (
    <>
      {[0, 1, 2, 3, 4].map((k) => (
        <View
          key={k}
          style={[
            styles.abs,
            { left: STAR_CX * s - R, top: STAR_CY * s - R, width: 2 * R, height: 2 * R, transform: [{ rotate: `${k * 72}deg` }] },
          ]}
        >
          <View
            style={[
              styles.abs,
              styles.triangle,
              { left: R - half, top: 0, borderLeftWidth: half, borderRightWidth: half, borderBottomWidth: height, borderBottomColor: color },
            ]}
          />
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  clip: { overflow: 'hidden' },
  triangle: {
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    backgroundColor: 'transparent',
  },
});
