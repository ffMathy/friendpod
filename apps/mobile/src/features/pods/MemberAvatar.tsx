import { StyleSheet, View } from 'react-native';
import { AuthenticatedPhoto } from '@/features/photos/AuthenticatedPhoto';
import type { MemberFill } from './memberFill';
import { MemberCircle } from './MemberCircle';

export interface MemberAvatarProps {
  readonly uid: string;
  readonly name: string;
  readonly size: number;
  /** The member's colour, from `memberFills` (the member's place in the pod); the viewer's "You" circle ignores it. */
  readonly fill: MemberFill;
  /** The member's photo version from the roster; null or absent draws the initial only. */
  readonly photoV?: number | null;
  /** Accessible name of the photo ("Photo of Anna"). */
  readonly photoLabel?: string;
  /** The viewer: the ink "You" circle instead of an initial or photo. */
  readonly you?: boolean;
  readonly youLabel?: string;
  /** A 2-pt ring (true: the surface colour; or a colour, e.g. on the green hero). */
  readonly ring?: boolean | string;
}

/**
 * A pod member's avatar: the coloured initial in their pod colour (MemberCircle), with the photo laid over it where
 * the roster has one. The initial stays underneath, so a photo that cannot be fetched (no grant, offline) still shows
 * the initial instead of an empty circle. Sensitive-themed pods only list a photo after its owner opted in (S6).
 */
export function MemberAvatar({ uid, name, size, fill, photoV, photoLabel, you = false, youLabel, ring }: MemberAvatarProps) {
  const inset = ring ? 2 : 0;
  const photo = !you && photoV !== null && photoV !== undefined;
  return (
    <View style={{ width: size, height: size }}>
      <MemberCircle name={name} size={size} fill={fill} you={you} youLabel={youLabel} ring={ring} />
      {photo ? (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.clip, { margin: inset, borderRadius: (size - 2 * inset) / 2 }]}
        >
          <AuthenticatedPhoto owner={uid} version={photoV} size="thumb" accessibilityLabel={photoLabel ?? name} style={styles.fill} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  fill: { width: '100%', height: '100%' },
});
