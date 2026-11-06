import { StyleSheet, View } from 'react-native';
import { Avatar } from '@/components/ui';
import { AuthenticatedPhoto } from '@/features/photos/AuthenticatedPhoto';
import type { MemberFill } from '@/features/pods/memberFill';

export interface MemberFaceProps {
  readonly uid: string;
  readonly name: string;
  /** Diameter: 32 in the feedback grid (storyboard 4.1), 64 in the member sheet (4.2). */
  readonly size: number;
  /** The member's pod colour (`memberFills`), so they look as they do on the pod page; hashed from `uid` without it. */
  readonly fill?: MemberFill;
  /** The viewer: the ink circle the pod page draws for "You". */
  readonly you?: boolean;
  /** The roster's photo version; null or absent draws the initial only (also pass null for a blocked member). */
  readonly photoV?: number | null;
  /** Accessible name of the photo ("Photo of Anna"); without it the photo is hidden from screen readers, as for an
   *  avatar next to a visible name. */
  readonly photoLabel?: string;
  /** An empty dashed seat, for a former member who is no longer in the roster. */
  readonly placeholder?: boolean;
}

/**
 * A pod member's face for the safety screens: the coloured initial, with the photo laid over it where the roster lists
 * one. The initial stays underneath, so a photo that cannot be fetched (no grant, offline) still shows the initial.
 */
export function MemberFace({ uid, name, size, fill, you = false, photoV, photoLabel, placeholder = false }: MemberFaceProps) {
  const photo = !placeholder && photoV !== null && photoV !== undefined;
  return (
    <View style={{ width: size, height: size }}>
      <Avatar name={name} uid={uid} fill={fill} you={you} size={size} placeholder={placeholder} />
      {photo ? (
        <View
          pointerEvents="none"
          accessibilityElementsHidden={photoLabel === undefined}
          importantForAccessibility={photoLabel === undefined ? 'no-hide-descendants' : 'auto'}
          style={[StyleSheet.absoluteFill, styles.clip, { borderRadius: size / 2 }]}
        >
          <AuthenticatedPhoto
            owner={uid}
            version={photoV}
            // 256 px: sharp up to the sheet's 64-pt circle at 3x.
            size="thumb"
            accessibilityLabel={photoLabel ?? name}
            style={styles.fill}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  fill: { width: '100%', height: '100%' },
});
