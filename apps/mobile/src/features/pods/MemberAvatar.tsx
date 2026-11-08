import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Avatar, Text } from '@/components/ui';
import { BorderWidth, usePalette } from '@/components/theme';
import { AuthenticatedPhoto } from '@/features/photos/AuthenticatedPhoto';
import type { PodColor } from '@/lib/podColor';

export interface MemberAvatarProps {
  readonly uid: string;
  readonly name: string;
  readonly size: number;
  /** `photoV` from the pod roster: the photo is drawn over the initial, so a photo that can't load leaves the initial. */
  readonly photoV?: number | null;
  readonly you?: boolean;
  /** A 2 px ring outside the circle (the avatar becomes size + 4), for overlapping stacks. */
  readonly ring?: boolean;
  /** The ring's colour: the card's white by default, the pod tint on the chat band. */
  readonly ringColor?: string;
  /** The pod's colour: the initial sits on its deep tone. `null`/absent: Ink 2 (a private pod, or outside one). */
  readonly color?: PodColor | null;
  /** Hasn't confirmed yet: the pod tint with a dashed deep border (blend decision 3; pair it with the quiet status). */
  readonly pending?: boolean;
}

/**
 * A pod member (blend spec §6.9): the initial on the pod's deep tone, with their photo on top when the roster has one
 * (a round crop; the pod colour never tints a photo). Decorative: names sit beside it.
 */
export function MemberAvatar({ uid, name, size, photoV = null, you = false, ring = false, ringColor, color = null, pending = false }: MemberAvatarProps) {
  const { t } = useTranslation();
  const p = usePalette();
  const inset = ring ? BorderWidth.strong : 0;
  const outer = size + 2 * inset;
  const photo = !you && photoV !== null;
  if (you && ring) {
    // "You" in an overlapping stack (pod-plan voters): the Ink ring takes the white ring's place at the outer edge, so
    // the Ink disc inside is large enough for "You" / "Dig" (32 → a 23 px disc with a 10 px label).
    const disc = outer - 2 * (YOU_RING + YOU_GAP);
    return (
      <View
        style={[styles.youStack, { width: outer, height: outer, borderRadius: outer / 2, borderColor: p.ink, backgroundColor: ringColor ?? p.surface }]}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        <View style={[styles.youDisc, { width: disc, height: disc, borderRadius: disc / 2, backgroundColor: p.ink }]}>
          <Text variant="badge" numberOfLines={1} style={[styles.youLabel, { color: p.onInk }]}>
            {t('common.you')}
          </Text>
        </View>
      </View>
    );
  }
  return (
    <View
      style={[
        { width: outer, height: outer, borderRadius: outer / 2 },
        ring ? { borderWidth: inset, borderColor: ringColor ?? p.surface, backgroundColor: ringColor ?? p.surface } : null,
      ]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <Avatar name={name} size={size} color={color} you={you} youLabel={t('common.you')} pending={pending && !photo} />
      {photo ? (
        <View style={[styles.photo, { width: size, height: size, borderRadius: size / 2 }]}>
          <AuthenticatedPhoto owner={uid} version={photoV} size="thumb" accessibilityLabel={t('pod.photoOf', { name })} style={{ width: size, height: size }} />
        </View>
      ) : null}
    </View>
  );
}

/** The stacked "You": a 2 px Ink ring, then 2.5 px of the ring colour, then the Ink disc (the pod-plan storyboard). */
const YOU_RING = 2;
const YOU_GAP = 2.5;

const styles = StyleSheet.create({
  photo: { position: 'absolute', left: 0, top: 0, overflow: 'hidden' },
  youStack: { borderWidth: YOU_RING, alignItems: 'center', justifyContent: 'center' },
  youDisc: { alignItems: 'center', justifyContent: 'center' },
  youLabel: { fontSize: 10, lineHeight: 12 },
});
