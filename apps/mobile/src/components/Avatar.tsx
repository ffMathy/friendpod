/**
 * Avatars (blend spec §6.9). A named member is a circle in the pod's **deep** tone with a white initial (8.2–11.6:1);
 * outside a pod, or in a private pod, it is Ink 2. "You" is an Ink dot inside a 2.5 px Ink ring. Someone who has not
 * confirmed yet is the pod tint with a 2 px dashed deep border (pair it with `StatusText` "Hasn't confirmed"). An open
 * seat is a dashed Field ring. Photos are round crops with a 2 px white ring; the pod colour never tints a photo.
 *
 * Avatars are decorative (the name next to them is the label) unless given an `accessibilityLabel`.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { PodColor } from '@/lib/podColor';
import { Icon } from './Icon';
import { Text } from './Text';
import { font, useColorSchemeName, usePalette, usePodColors } from './theme';

/** Initial font size per avatar size (32 → 13, 52 → 20, 72 → 28). */
function initialSize(size: number): number {
  if (size >= 72) return 28;
  if (size >= 52) return 20;
  if (size >= 44) return 17;
  if (size >= 32) return 13;
  return 12;
}

export interface AvatarProps {
  /** First name; its first letter is shown. */
  readonly name?: string;
  /** Kept for existing call sites (colours now come from the pod, not the person). */
  readonly seed?: string;
  /** 32 (rows), 44 (seats), 52 (reveal foot), 72 (member sheet). Default 32. */
  readonly size?: number;
  /** The pod colour (fill = its deep tone). `null`/`'private'`: Ink 2 (outside a pod, or a private pod). */
  readonly color?: PodColor | 'private' | null;
  /** The viewer: an Ink dot with `youLabel` ("You") inside an Ink ring. */
  readonly you?: boolean;
  readonly youLabel?: string;
  /** Not confirmed yet (someone else): the pod tint, a 2 px dashed deep border, an Ink initial. */
  readonly pending?: boolean;
  /** A photo element (e.g. AuthenticatedPhoto), clipped to the circle. */
  readonly photo?: ReactNode;
  /** The person keeps their photo hidden in this pod: initials with a small lock. */
  readonly photoHidden?: boolean;
  /** An open seat (dashed Field ring). */
  readonly placeholder?: boolean;
  /** A 2 px surface-coloured ring outside the circle (the avatar becomes size + 4), for overlapping stacks. */
  readonly ring?: boolean;
  /** Avatars are decorative unless labelled; the name is usually printed next to them. */
  readonly accessibilityLabel?: string;
}

export function Avatar({ name, size = 32, color, you = false, youLabel, pending = false, photo, photoHidden = false, placeholder = false, ring = false, accessibilityLabel }: AvatarProps) {
  const p = usePalette();
  const dark = useColorSchemeName() === 'dark';
  const c = usePodColors(color === 'private' ? null : color);
  const outer = ring ? size + 4 : size;
  const circle = { width: outer, height: outer, borderRadius: outer / 2 };
  const a11y = accessibilityLabel
    ? { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel }
    : { accessible: false, importantForAccessibility: 'no-hide-descendants' as const, accessibilityElementsHidden: true };
  const ringStyle = ring ? { borderWidth: 2, borderColor: p.surface } : null;

  if (placeholder) {
    return <View {...a11y} style={[styles.center, circle, { borderWidth: 2, borderStyle: 'dashed', borderColor: p.field }]} />;
  }

  if (you) {
    const inner = size - 2 * (2.5 + 3);
    const fontSize = size >= 52 ? 13 : size >= 44 ? 12 : Math.max(9, Math.round(inner * 0.42));
    return (
      <View {...a11y} style={[styles.center, circle, ring ? { backgroundColor: p.surface } : null]}>
        <View style={[styles.center, { width: size, height: size, borderRadius: size / 2, borderWidth: 2.5, borderColor: p.ink }]}>
          <View style={[styles.center, { width: inner, height: inner, borderRadius: inner / 2, backgroundColor: p.ink }]}>
            <Text style={[font('800'), { fontSize, lineHeight: Math.round(fontSize * 1.2), color: p.onInk }]} numberOfLines={1}>
              {youLabel ?? ''}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  const label = (name ?? '').trim().slice(0, 1).toUpperCase();
  const fontSize = initialSize(size);
  const named = color !== undefined && color !== null && color !== 'private';
  // No pod colour (outside a pod, or a private pod): the quiet Ink 2 fill.
  const bg = pending ? c.pendingBg : c.avatar;
  const fg = pending ? c.pendingText : c.onAvatar;
  const pendingBorder = pending ? { borderWidth: 2, borderStyle: 'dashed' as const, borderColor: named ? c.pendingBorder : p.field } : null;
  const tintRing = dark && named && !pending && !ring ? { borderWidth: 2, borderColor: c.avatarRing } : null;
  return (
    <View {...a11y} style={[styles.center, circle, { backgroundColor: photo && !photoHidden ? p.surface : bg }, ringStyle, pendingBorder, tintRing]}>
      {photo && !photoHidden ? (
        <View style={[StyleSheet.absoluteFill, styles.clip, { borderRadius: outer / 2, borderWidth: 2, borderColor: p.surface }]}>{photo}</View>
      ) : (
        <Text style={[font('800'), { fontSize, lineHeight: Math.round(fontSize * 1.2), color: fg }]}>{label}</Text>
      )}
      {photoHidden ? (
        <View style={[styles.lock, { backgroundColor: p.ink, borderColor: p.surface }]}>
          <Icon name="lock" size={10} color={p.onInk} strokeWidth={2.6} />
        </View>
      ) : null}
    </View>
  );
}

export interface AvatarStackPerson {
  readonly key: string;
  readonly name?: string;
  readonly seed?: string;
  readonly you?: boolean;
  readonly pending?: boolean;
}

/** Overlapping avatars (pod rows, the chat band): each with a 2 px surface ring, pulled left by `overlap` (10). */
export function AvatarStack({
  people,
  size = 32,
  overlap = 10,
  youLabel,
  color,
}: {
  people: readonly AvatarStackPerson[];
  size?: number;
  overlap?: number;
  youLabel?: string;
  /** The pod's colour (deep fills); `null`/`'private'` for Ink 2. */
  color?: PodColor | 'private' | null;
}) {
  return (
    <View style={styles.stack} accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {people.map((person, i) => (
        <View key={person.key} style={i > 0 ? { marginLeft: -overlap } : null}>
          <Avatar name={person.name} color={color} you={person.you} pending={person.pending} youLabel={youLabel} size={size} ring />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  clip: { overflow: 'hidden' },
  lock: { position: 'absolute', right: -2, bottom: -2, width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  stack: { flexDirection: 'row' },
});
