/**
 * Every icon the storyboards draw, as react-native-svg on a 24 × 24 grid (stroke icons, round caps and joins).
 * Decorative by default (hidden from screen readers); pass `accessibilityLabel` when the icon carries meaning on
 * its own, such as the lock on a private interest.
 */
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { usePalette } from './theme';

type Shape =
  | { readonly d: string }
  | { readonly cx: number; readonly cy: number; readonly r: number }
  | { readonly x: number; readonly y: number; readonly width: number; readonly height: number; readonly rx: number };

interface IconSpec {
  readonly shapes: readonly Shape[];
  /** The storyboard's stroke width at its usual size. */
  readonly strokeWidth: number;
  /** Solid glyph (filled with the colour, no stroke). */
  readonly solid?: boolean;
}

const CALENDAR = 'M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z';
const STAR = 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z';

export const ICONS = {
  /** Back chevron (44 px button, top left). */
  back: { strokeWidth: 2, shapes: [{ d: 'M15 5l-7 7 7 7' }] },
  /** Row chevron. */
  chevronRight: { strokeWidth: 2, shapes: [{ d: 'M9 5l7 7-7 7' }] },
  /** Close (sheets, modal forms) and chip remove. */
  close: { strokeWidth: 2.2, shapes: [{ d: 'M6 6l12 12M18 6L6 18' }] },
  check: { strokeWidth: 2, shapes: [{ d: 'M5 12.5l4.5 4.5L19 7.5' }] },
  plus: { strokeWidth: 2.2, shapes: [{ d: 'M12 5v14M5 12h14' }] },
  /** Tab: This week. */
  calendar: { strokeWidth: 2, shapes: [{ d: CALENDAR }] },
  /** Add to calendar. */
  calendarAdd: { strokeWidth: 2, shapes: [{ d: `${CALENDAR}M12 12v5M9.5 14.5h5` }] },
  /** Tab: Pods; "5 people". */
  people: {
    strokeWidth: 2,
    shapes: [{ cx: 9, cy: 8, r: 3 }, { cx: 17, cy: 9, r: 2.5 }, { d: 'M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M15 14.5c3 0 6 2 6 5.5' }],
  },
  /** Tab: Interests; shared interests. */
  tag: { strokeWidth: 2, shapes: [{ d: 'M3 12V4h8l10 10-8 8L3 12z' }, { cx: 7.5, cy: 7.5, r: 1.5 }] },
  /** Tab: Me. */
  person: { strokeWidth: 2, shapes: [{ cx: 12, cy: 8, r: 4 }, { d: 'M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8' }] },
  /** Area / place. */
  pin: { strokeWidth: 2, shapes: [{ d: 'M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z' }, { cx: 12, cy: 10, r: 2.5 }] },
  /** Deadlines, priority, quick chat notes. */
  clock: { strokeWidth: 2, shapes: [{ cx: 12, cy: 12, r: 9 }, { d: 'M12 7v5l3 2' }] },
  /** Private interests. */
  lock: { strokeWidth: 2.2, shapes: [{ x: 5, y: 11, width: 14, height: 10, rx: 2 }, { d: 'M8 11V8a4 4 0 0 1 8 0v3' }] },
  camera: { strokeWidth: 1.8, shapes: [{ d: 'M4 8h3l2-3h6l2 3h3v11H4z' }, { cx: 12, cy: 13, r: 3.5 }] },
  bell: { strokeWidth: 1.8, shapes: [{ d: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4z' }, { d: 'M10 20a2 2 0 0 0 4 0' }] },
  info: { strokeWidth: 2, shapes: [{ cx: 12, cy: 12, r: 9 }, { d: 'M12 11v5M12 8h.01' }] },
  /** Safety pledge, meeting safely, 112. */
  shield: { strokeWidth: 2, shapes: [{ d: 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z' }] },
  /** Star outline (not starred). */
  star: { strokeWidth: 1.8, shapes: [{ d: STAR }] },
  /** Starred: filled with `fill` (default accent), outlined with `color` (default the star stroke). */
  starFilled: { strokeWidth: 1.5, shapes: [{ d: STAR }] },
  /** Chat send. */
  send: { strokeWidth: 2.2, shapes: [{ d: 'M5 12h13M13 6l6 6-6 6' }] },
  search: { strokeWidth: 2, shapes: [{ cx: 11, cy: 11, r: 6 }, { d: 'M20 20l-4.5-4.5' }] },
  chat: { strokeWidth: 2, shapes: [{ d: 'M4 5h16v11H9l-5 4z' }] },
  /** Download my data. */
  download: { strokeWidth: 2, shapes: [{ d: 'M12 4v11M7 10l5 5 5-5M5 20h14' }] },
  /** Share invite link. */
  share: { strokeWidth: 2, shapes: [{ d: 'M12 15V3M7 8l5-5 5 5M5 13v7h14v-7' }] },
  /** Overflow menu (three dots). */
  more: { strokeWidth: 0, solid: true, shapes: [{ cx: 5, cy: 12, r: 1.8 }, { cx: 12, cy: 12, r: 1.8 }, { cx: 19, cy: 12, r: 1.8 }] },
  /** Pause matching. */
  pause: { strokeWidth: 2, shapes: [{ d: 'M9 5v14M15 5v14' }] },
  /** Delete account. */
  trash: { strokeWidth: 2, shapes: [{ d: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13' }] },
  /** Block / blocked people. */
  block: { strokeWidth: 2, shapes: [{ cx: 12, cy: 12, r: 9 }, { d: 'M5.6 5.6l12.8 12.8' }] },
  /** Report. */
  flag: { strokeWidth: 2, shapes: [{ d: 'M5 21V4M5 4h11l-2 4 2 4H5' }] },
} as const satisfies Record<string, IconSpec>;

export type IconName = keyof typeof ICONS;

export interface IconProps {
  readonly name: IconName;
  /** Rendered size in px (the storyboards use 14, 16, 18, 20, 22, 24 and 28). Default 24. */
  readonly size?: number;
  /** Stroke colour (solid icons: fill colour). Default: the text colour. */
  readonly color?: ColorValue;
  /** Fill for `starFilled` (default: accent). */
  readonly fill?: ColorValue;
  /** Overrides the storyboard stroke width. */
  readonly strokeWidth?: number;
  /** Makes the icon an image with this label; without it the icon is decorative. */
  readonly accessibilityLabel?: string;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}

export function Icon({ name, size = 24, color, fill, strokeWidth, accessibilityLabel, style, testID }: IconProps) {
  const p = usePalette();
  const spec: IconSpec = ICONS[name];
  const starred = name === 'starFilled';
  const stroke = color ?? (starred ? p.starStroke : p.text);
  const solid = spec.solid === true;
  const shapeFill = solid ? stroke : starred ? (fill ?? p.accent) : 'none';
  const common = {
    fill: shapeFill,
    stroke: solid ? 'none' : stroke,
    strokeWidth: solid ? 0 : (strokeWidth ?? spec.strokeWidth),
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  const a11y = accessibilityLabel
    ? { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel }
    : { accessible: false, accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style} testID={testID} {...a11y}>
      {spec.shapes.map((s, i) =>
        'd' in s ? (
          <Path key={i} d={s.d} {...common} />
        ) : 'cx' in s ? (
          <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} {...common} />
        ) : (
          <Rect key={i} x={s.x} y={s.y} width={s.width} height={s.height} rx={s.rx} {...common} />
        ),
      )}
    </Svg>
  );
}
