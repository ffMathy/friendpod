import { StyleSheet, Text, View } from 'react-native';
import { Fonts, usePalette } from '@/components/theme';
import type { MemberFill } from './memberFill';

export interface MemberCircleProps {
  readonly name: string;
  readonly size: number;
  /** The member's colour, from `memberFills` (the member's place in the pod); the viewer's "You" circle ignores it. */
  readonly fill: MemberFill;
  /** The viewer: the ink circle with `youLabel` instead of an initial. */
  readonly you?: boolean;
  readonly youLabel?: string;
  /** A 2-pt ring (true: the surface colour; or a colour, e.g. on the green hero). */
  readonly ring?: boolean | string;
}

/**
 * A pod member's coloured initial (storyboards 3.1–3.5). The colour is passed in rather than hashed from the uid, so
 * the members of one pod never share a colour and each keeps theirs on every pod screen (see `memberFills`).
 * Decorative: the name next to it, or the row around it, names the member.
 */
export function MemberCircle({ name, size, fill, you = false, youLabel, ring }: MemberCircleProps) {
  const p = usePalette();
  const text = you ? (youLabel ?? '') : (Array.from(name.trim())[0]?.toLocaleUpperCase() ?? '');
  // Storyboard sizes: an initial is 17 pt on 52, 12 on 32 and 11 on 28; "You" is 15 on 52 and 9 on 28.
  const fontSize = Math.round(size / 4 + (text.length > 1 ? 2 : 4));
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: you ? p.ink : fill.bg },
        ring ? { borderWidth: 2, borderColor: typeof ring === 'string' ? ring : p.surface } : null,
      ]}
    >
      <Text allowFontScaling={false} numberOfLines={1} style={[Fonts.extrabold, { fontSize, color: you ? p.onInk : fill.fg }]}>
        {text}
      </Text>
    </View>
  );
}

export interface MemberStackItem {
  readonly uid: string;
  readonly name: string;
  readonly fill: MemberFill;
  /** The viewer, drawn as the ink "You" circle. */
  readonly you?: boolean;
}

export interface MemberStackProps {
  /** In display order; the voter stacks put the viewer last (storyboard 3.2). */
  readonly members: readonly MemberStackItem[];
  readonly size: number;
  /** Show at most this many. */
  readonly max?: number;
  /** The "You" label (t('chat.you')). */
  readonly youLabel: string;
}

/**
 * Overlapping member initials with white rings: the plan's voters (storyboard 3.2) and the chat header (3.5). Each
 * member keeps their pod colour. Decorative: the yes count or the screen title next to it carries the meaning.
 */
export function MemberStack({ members, size, max, youLabel }: MemberStackProps) {
  const shown = max === undefined ? members : members.slice(0, max);
  return (
    <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.stack}>
      {shown.map((m, i) => (
        <View key={m.uid} style={i > 0 ? { marginLeft: -Math.round(size * 0.3) } : null}>
          <MemberCircle name={m.name} size={size} fill={m.fill} you={m.you} youLabel={youLabel} ring />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  stack: { flexDirection: 'row', alignItems: 'center' },
});
