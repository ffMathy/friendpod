import type { UserDoc } from '@grouper/core';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';
import { usePalette } from '@/components/theme';
import { Avatar, Badge, Button, Card, ErrorText, Headline, Icon, Small, Text } from '@/components/ui';
import { useCallable } from '@/data/useCallable';
import { clearImageCaches } from '@/features/account/clearDeviceData';
import { AuthenticatedPhoto } from '@/features/photos/AuthenticatedPhoto';
import { usePhotoUpload } from '@/features/photos/upload';
import { errorMessageKey } from '@/lib/errors';
import { DangerTextButton } from './parts';

const AVATAR = 72;

/**
 * The top of Me: the photo (or onb-final's mint camera circle), first name, area and the user's own attendance record,
 * then who can see the photo and the add, change and delete actions (§3.1 step 10, §9 Photos). A new upload replaces
 * the old version once `onPhotoUploaded` has checked it; deleting asks first and clears the image caches.
 */
export function ProfileCard({ uid, user }: { readonly uid: string; readonly user: Pick<UserDoc, 'firstName' | 'area' | 'photo' | 'stats'> }) {
  const { t } = useTranslation();
  const p = usePalette();
  const { state, choose } = usePhotoUpload(uid);
  const remove = useCallable('deletePhoto');
  const version = user.photo?.v ?? null;
  const attended = user.stats.attended;
  const meetups = attended + user.stats.noShows;
  const confirmDelete = () =>
    Alert.alert(t('me.deletePhotoTitle'), t('me.deletePhotoBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('me.deletePhoto'),
        style: 'destructive',
        onPress: () => remove.mutate({}, { onSuccess: () => void clearImageCaches().catch(() => undefined) }),
      },
    ]);
  return (
    <Card gap={14} testID="profile-card">
      <View style={styles.top}>
        {version !== null ? (
          <Avatar
            size={AVATAR}
            name={user.firstName}
            seed={uid}
            accessibilityLabel={t('me.yourPhoto')}
            photo={<AuthenticatedPhoto owner={uid} version={version} size="thumb" accessibilityLabel={t('me.yourPhoto')} style={styles.photo} />}
          />
        ) : (
          <View style={[styles.camera, { backgroundColor: p.mint }]} accessible={false}>
            <Icon name="camera" size={28} color={p.primary} />
          </View>
        )}
        <View style={styles.who}>
          <Headline>{user.firstName}</Headline>
          {user.area.label ? (
            <View style={styles.area}>
              <Icon name="pin" size={16} color={p.textMuted} />
              <Text variant="small" color="textMuted">
                {user.area.label}
              </Text>
            </View>
          ) : null}
          <View style={styles.badge} testID="me-record">
            {meetups === 0 ? (
              <Badge tone="outline" size="sm" label={t('me.noMeetupsYet')} />
            ) : (
              <Badge tone="mint" size="sm" icon="check" label={t('me.attended', { attended, total: meetups })} />
            )}
          </View>
        </View>
      </View>
      <Text variant="caption" color="textMuted" style={styles.tight}>
        {t('me.photoWho')}
      </Text>
      <View style={styles.actions}>
        <Button
          testID="photo-choose"
          label={version === null && state !== 'done' ? t('me.addPhoto') : t('me.changePhoto')}
          icon="camera"
          variant="outline"
          size="xs"
          busy={state === 'uploading'}
          onPress={() => void choose()}
        />
        {version !== null ? (
          <DangerTextButton testID="photo-delete" label={t('me.deletePhoto')} icon="trash" busy={remove.isPending} onPress={confirmDelete} />
        ) : null}
      </View>
      {state === 'done' && version === null ? <Small color="onMint">{t('me.photoUploaded')}</Small> : null}
      {state === 'failed' ? <ErrorText>{t('me.photoFailed')}</ErrorText> : null}
      {remove.error ? <ErrorText>{t(errorMessageKey(remove.error))}</ErrorText> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  camera: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, alignItems: 'center', justifyContent: 'center' },
  photo: { width: AVATAR, height: AVATAR },
  who: { flex: 1, gap: 4, alignItems: 'flex-start' },
  area: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badge: { marginTop: 4 },
  // onb-final sets the photo line at 13/1.45.
  tight: { lineHeight: 19 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
});
