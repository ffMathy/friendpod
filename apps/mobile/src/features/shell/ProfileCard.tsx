import type { UserDoc } from '@friendpod/core';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';
import { usePalette } from '@/components/theme';
import { Avatar, Button, Card, ErrorText, Headline, Icon, Small, StatusText, Text } from '@/components/ui';
import { useCallable } from '@/data/useCallable';
import { clearImageCaches } from '@/features/account/clearDeviceData';
import { AuthenticatedPhoto } from '@/features/photos/AuthenticatedPhoto';
import { usePhotoUpload } from '@/features/photos/upload';
import { errorMessageKey } from '@/lib/errors';

const AVATAR = 72;

/**
 * No photo yet: onb-final's photo slot, a dashed Field ring (the grammar's "open, not yet") with an Ink 2 camera.
 * Decorative: the "Add a photo" button under it is the action.
 */
function PhotoSlot() {
  const p = usePalette();
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.slot, { borderColor: p.field, backgroundColor: p.surface }]}>
      <Icon name="camera" size={26} color={p.textSecondary} />
    </View>
  );
}

/**
 * The top of Me: the photo (or the dashed photo slot), first name, area and the user's own attendance record as a
 * quiet status, then who can see the photo and the add, change and delete actions (§3.1 step 10, §9 Photos). Outside a
 * pod there is no pod colour: the initial sits on Ink 2. A new upload replaces the old version once `onPhotoUploaded`
 * has checked it; deleting (the Danger outline button) asks first and clears the image caches.
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
            accessibilityLabel={t('me.yourPhoto')}
            photo={<AuthenticatedPhoto owner={uid} version={version} size="thumb" accessibilityLabel={t('me.yourPhoto')} style={styles.photo} />}
          />
        ) : (
          <PhotoSlot />
        )}
        <View style={styles.who}>
          <Headline>{user.firstName}</Headline>
          {user.area.label ? (
            <View style={styles.area}>
              <Icon name="pin" size={16} color={p.textSecondary} />
              <Text variant="small" color="textSecondary">
                {user.area.label}
              </Text>
            </View>
          ) : null}
          <View style={styles.record} testID="me-record">
            {meetups === 0 ? (
              <StatusText icon="calendar" label={t('me.noMeetupsYet')} />
            ) : (
              <StatusText icon="check" label={t('me.attended', { attended, total: meetups })} />
            )}
          </View>
        </View>
      </View>
      <Text variant="caption" color="textMuted">
        {t('me.photoWho')}
      </Text>
      <View style={styles.actions}>
        <Button
          testID="photo-choose"
          label={version === null && state !== 'done' ? t('me.addPhoto') : t('me.changePhoto')}
          icon="camera"
          variant="secondary"
          size="sm"
          busy={state === 'uploading'}
          onPress={() => void choose()}
        />
        {version !== null ? (
          <Button testID="photo-delete" label={t('me.deletePhoto')} variant="danger" size="sm" busy={remove.isPending} onPress={confirmDelete} />
        ) : null}
      </View>
      {state === 'done' && version === null ? <Small color="textSecondary">{t('me.photoUploaded')}</Small> : null}
      {state === 'failed' ? <ErrorText>{t('me.photoFailed')}</ErrorText> : null}
      {remove.error ? <ErrorText>{t(errorMessageKey(remove.error))}</ErrorText> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  slot: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  photo: { width: AVATAR, height: AVATAR },
  who: { flex: 1, gap: 4, alignItems: 'flex-start' },
  area: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  record: { marginTop: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
});
