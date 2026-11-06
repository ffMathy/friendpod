import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';
import { Fonts, usePalette } from '@/components/theme';
import { AppText, Button, Card, ChipRow, ErrorText, Icon } from '@/components/ui';
import { useCallable } from '@/data/useCallable';
import { clearImageCaches } from '@/features/account/clearDeviceData';
import { errorMessageKey } from '@/lib/errors';
import { AuthenticatedPhoto } from './AuthenticatedPhoto';
import { usePhotoUpload } from './upload';

const SIZE = 72;

export interface PhotoCardProps {
  readonly uid: string;
  /** The current photo version, or null without one. */
  readonly version: number | null;
  /** Default "Photo" (Me); onboarding passes "A photo, so your pod recognises you". */
  readonly title?: string;
  /** Muted suffix after the title ("(optional)"). */
  readonly optionalLabel?: string;
  /** Who sees it; default the Me copy. */
  readonly description?: string;
}

/**
 * The user's own photo (§3.1 step 10, §9 Photos; storyboard 1.7): the current version in a 72-pt circle (a camera on
 * mint without one), add or change it (a new upload replaces the old version once `onPhotoUploaded` has checked it)
 * and delete it.
 */
export function PhotoCard({ uid, version, title, optionalLabel, description }: PhotoCardProps) {
  const { t } = useTranslation();
  const p = usePalette();
  const { state, choose } = usePhotoUpload(uid);
  const remove = useCallable('deletePhoto');
  const confirmDelete = () =>
    Alert.alert(t('settings.privacy.deletePhoto'), t('settings.privacy.deletePhotoBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.privacy.deletePhoto'),
        style: 'destructive',
        onPress: () => remove.mutate({}, { onSuccess: () => void clearImageCaches().catch(() => undefined) }),
      },
    ]);
  return (
    <Card gap={12}>
      <View style={styles.row}>
        <View style={[styles.avatar, { backgroundColor: p.mint }]}>
          <Icon name="camera" size={28} strokeWidth={1.8} color={p.primary} />
          {version !== null ? (
            <AuthenticatedPhoto
              owner={uid}
              version={version}
              size="thumb"
              accessibilityLabel={t('me.yourPhoto')}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
        </View>
        <View style={styles.text}>
          <AppText accessibilityRole="header" variant="section">
            {title ?? t('me.photo')}
            {optionalLabel ? <AppText variant="section" tone="muted" style={Fonts.medium}>{` ${optionalLabel}`}</AppText> : null}
          </AppText>
          <AppText variant="caption" tone="muted">
            {description ?? t('me.photoWho')}
          </AppText>
          <ChipRow>
            <Button
              testID="photo-choose"
              label={version === null ? t('me.addPhoto') : t('me.changePhoto')}
              variant="secondary"
              size="xs"
              inline
              busy={state === 'uploading'}
              onPress={() => void choose()}
            />
            {version !== null ? (
              <Button
                testID="photo-delete"
                label={t('settings.privacy.deletePhoto')}
                variant="dangerSoft"
                size="xs"
                inline
                busy={remove.isPending}
                onPress={confirmDelete}
              />
            ) : null}
          </ChipRow>
        </View>
      </View>
      {state === 'done' ? (
        <AppText variant="caption" tone="mint">
          {t('onboarding.photo.uploaded')}
        </AppText>
      ) : null}
      {state === 'failed' ? <ErrorText>{t('me.photoFailed')}</ErrorText> : null}
      {remove.error ? <ErrorText>{t(errorMessageKey(remove.error))}</ErrorText> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 6 },
});
