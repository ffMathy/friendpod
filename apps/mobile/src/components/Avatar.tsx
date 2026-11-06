/**
 * Avatars: an initial on a pastel circle (stable colour per person), the near-black "You", a photo, a hidden
 * photo (private-interest pods: initials plus a lock), and the dashed empty seat on a proposal.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon } from './Icon';
import { Text } from './Text';
import { avatarColorKey, font, usePalette } from './theme';

/** Initial font size per avatar size, as drawn (28→11, 32→12, 44→13, 52→17, 64→24). */
function initialSize(size: number): number {
  if (size >= 64) return 24;
  if (size >= 52) return 17;
  if (size >= 44) return 13;
  if (size >= 32) return 12;
  return 11;
}

export interface AvatarProps {
  /** First name; its first letter is shown. */
  readonly name?: string;
  /** Picks the colour (use the uid so a person keeps their colour everywhere). Defaults to the name. */
  readonly seed?: string;
  /** 28, 30, 32 (lists), 44 (proposal), 52 (confirmed card), 64 (member sheet). Default 32. */
  readonly size?: number;
  /** The viewer: near-black with `youLabel` ("You"). */
  readonly you?: boolean;
  readonly youLabel?: string;
  /** A photo element (e.g. AuthenticatedPhoto), clipped to the circle. */
  readonly photo?: ReactNode;
  /** The person keeps their photo hidden in this pod: initials with a small lock. */
  readonly photoHidden?: boolean;
  /** An empty seat (dashed outline). */
  readonly placeholder?: boolean;
  /** A 2 px ring in the surface colour outside the circle (the avatar becomes size + 4), for overlapping stacks. */
  readonly ring?: boolean;
  /** Avatars are decorative unless labelled; the name is usually printed next to them. */
  readonly accessibilityLabel?: string;
}

export function Avatar({ name, seed, size = 32, you = false, youLabel, photo, photoHidden = false, placeholder = false, ring = false, accessibilityLabel }: AvatarProps) {
  const p = usePalette();
  const outer = ring ? size + 4 : size;
  const circle = { width: outer, height: outer, borderRadius: outer / 2 };
  const a11y = accessibilityLabel
    ? { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel }
    : { accessible: false, importantForAccessibility: 'no-hide-descendants' as const, accessibilityElementsHidden: true };
  if (placeholder) {
    return <View {...a11y} style={[styles.center, circle, { backgroundColor: p.surfaceMuted, borderWidth: 2, borderStyle: 'dashed', borderColor: p.borderDashed }]} />;
  }
  const bg = you ? p.ink : p[avatarColorKey(seed ?? name ?? '')];
  const fg = you ? p.onInk : p.onAvatar;
  const label = you ? (youLabel ?? '') : (name ?? '').trim().slice(0, 1).toUpperCase();
  const fontSize = you ? Math.max(9, initialSize(size) - (size >= 52 ? 2 : size <= 28 ? 2 : 0)) : initialSize(size);
  return (
    <View {...a11y} style={[styles.center, circle, { backgroundColor: bg }, ring ? { borderWidth: 2, borderColor: p.surface } : null]}>
      {photo && !photoHidden ? (
        <View style={[StyleSheet.absoluteFill, styles.clip, { borderRadius: outer / 2 }]}>{photo}</View>
      ) : (
        <Text style={[font('800'), { fontSize, lineHeight: Math.round(fontSize * 1.2), color: fg }]}>{label}</Text>
      )}
      {photoHidden ? (
        <View style={[styles.lock, { backgroundColor: p.private, borderColor: p.surface }]}>
          <Icon name="lock" size={10} color={p.onPrivate} strokeWidth={2.6} />
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
}

/** Overlapping avatars (pod rows, chat header, vote counts): each ringed, pulled left by `overlap`. */
export function AvatarStack({ people, size = 32, overlap = 10, youLabel }: { people: readonly AvatarStackPerson[]; size?: number; overlap?: number; youLabel?: string }) {
  return (
    <View style={styles.stack} accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {people.map((person, i) => (
        <View key={person.key} style={i > 0 ? { marginLeft: -overlap } : null}>
          <Avatar name={person.name} seed={person.seed ?? person.key} you={person.you} youLabel={youLabel} size={size} ring />
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
