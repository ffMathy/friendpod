import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Avatar } from '@/components/ui';
import { BorderWidth } from '@/components/theme';
import { AuthenticatedPhoto } from '@/features/photos/AuthenticatedPhoto';

export interface MemberAvatarProps {
  readonly uid: string;
  readonly name: string;
  readonly size: number;
  /** `photoV` from the pod roster: the photo is drawn over the initial, so a photo that can't load leaves the initial. */
  readonly photoV?: number | null;
  readonly you?: boolean;
  readonly ring?: boolean;
}

/** An initial on the member's colour, with their photo on top when the roster has one. Decorative: names sit beside it. */
export function MemberAvatar({ uid, name, size, photoV = null, you = false, ring = false }: MemberAvatarProps) {
  const { t } = useTranslation();
  const inset = ring ? BorderWidth.strong : 0;
  return (
    <View style={{ width: size + 2 * inset, height: size + 2 * inset }} accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Avatar name={name} seed={uid} size={size} you={you} youLabel={t('common.you')} ring={ring} />
      {!you && photoV !== null ? (
        <View style={[styles.photo, { left: inset, top: inset, width: size, height: size, borderRadius: size / 2 }]}>
          <AuthenticatedPhoto owner={uid} version={photoV} size="thumb" accessibilityLabel={t('pod.photoOf', { name })} style={{ width: size, height: size }} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  photo: { position: 'absolute', overflow: 'hidden' },
});
