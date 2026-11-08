import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { usePalette } from '@/components/theme';
import { Badge, Button, Card, ErrorText, Heading, Icon, Small, Text } from '@/components/ui';
import { pushPermissionGranted, registerPushToken, requestPushPermission } from '@/features/notifications/push';
import { AuthenticatedPhoto } from '@/features/photos/AuthenticatedPhoto';
import { usePhotoUpload } from '@/features/photos/upload';

const AVATAR = 72;

/**
 * "A photo, so your pod recognises you (optional)" (onb-final; §3.1 step 10): the mint camera circle, or the photo once
 * the server has published it; "Add a photo" opens the picker and uploads (§9 Photos).
 */
export function PhotoStepCard({ uid, version }: { readonly uid: string; readonly version: number | null }) {
  const { t } = useTranslation();
  const p = usePalette();
  const { state, choose } = usePhotoUpload(uid);
  return (
    <Card style={styles.row} gap={14}>
      <View style={[styles.avatar, { backgroundColor: p.inset }]}>
        {version !== null ? (
          <AuthenticatedPhoto owner={uid} version={version} size="thumb" accessibilityLabel={t('onboarding.final.yourPhoto')} style={styles.photo} />
        ) : (
          <Icon name="camera" size={28} color={p.primary} />
        )}
      </View>
      <View style={styles.text}>
        <Heading style={styles.normal15}>
          {t('onboarding.final.photoTitle')}
          <Text variant="heading" weight="500" color="textMuted" style={styles.normal15}>{` ${t('common.optional')}`}</Text>
        </Heading>
        <Text variant="caption" color="textMuted" style={styles.tight}>
          {t('onboarding.final.photoBody')}
        </Text>
        <Button
          testID="photo-choose"
          label={version === null && state !== 'done' ? t('onboarding.final.addPhoto') : t('onboarding.final.changePhoto')}
          variant="outline"
          size="xs"
          busy={state === 'uploading'}
          onPress={() => void choose()}
        />
        {state === 'done' && version === null ? <Small color="textSecondary">{t('onboarding.photo.uploaded')}</Small> : null}
        {state === 'failed' ? <ErrorText>{t('onboarding.photo.failed')}</ErrorText> : null}
      </View>
    </Card>
  );
}

/**
 * "Know when your drop arrives" (onb-final; §3.1 step 11): asks for the notification permission. Pushes never name a
 * theme, a person or what anyone wrote (S4). Saying no is fine; Settings can turn them on later.
 */
export function NotificationsStepCard() {
  const { t } = useTranslation();
  const p = usePalette();
  const [status, setStatus] = useState<'ask' | 'on' | 'off'>('ask');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void pushPermissionGranted()
      .then((granted) => {
        if (granted && active) setStatus('on');
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      const granted = await requestPushPermission();
      setStatus(granted ? 'on' : 'off');
      // A failed registration is retried at every app start once the permission is there (usePushTokenSync).
      if (granted) await registerPushToken().catch(() => undefined);
    } catch {
      setStatus('off');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={styles.rowTop} gap={14}>
      <Icon name="bell" size={24} color={p.primary} style={styles.iconNudge} />
      <View style={styles.text}>
        <Heading style={styles.normal15}>{t('onboarding.final.notifTitle')}</Heading>
        <Text variant="caption" color="textMuted" style={styles.tight}>
          {t('onboarding.final.notifBody')}
        </Text>
        {status === 'on' ? (
          <View testID="notifications-on">
            <Badge label={t('onboarding.final.notifOn')} tone="status" icon="check" />
          </View>
        ) : (
          <Button testID="notifications-enable" label={t('onboarding.final.notifEnable')} variant="secondary" size="xs" busy={busy} onPress={() => void enable()} />
        )}
        {status === 'off' ? <Small>{t('onboarding.final.notifOff')}</Small> : null}
      </View>
    </Card>
  );
}

/** "Our safety pledge" (onb-final; §3.1 step 11): one unticked checkbox, needed to finish. */
export function PledgeCard({ agreed, onChange }: { readonly agreed: boolean; readonly onChange: (agreed: boolean) => void }) {
  const { t } = useTranslation();
  const p = usePalette();
  return (
    <Card gap={12}>
      <View style={styles.pledgeTitle}>
        <Icon name="shield" size={20} color={p.textSecondary} />
        <Heading>{t('onboarding.final.pledgeTitle')}</Heading>
      </View>
      <PledgeCheckbox label={t('onboarding.final.pledge')} checked={agreed} onChange={onChange} />
    </Card>
  );
}

/**
 * The pledge's checkbox as onb-final draws it: a 22 px box 1 px down, 12 px from the 14/1.5 text (Checkbox's box is
 * 24 px, which wraps the pledge differently). Unticked until the user ticks it; a 44 px touch target.
 */
function PledgeCheckbox({ label, checked, onChange }: { readonly label: string; readonly checked: boolean; readonly onChange: (checked: boolean) => void }) {
  const p = usePalette();
  return (
    <Pressable
      testID="pledge"
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => [styles.pledgeRow, { opacity: pressed ? 0.8 : 1 }]}
    >
      <View style={[styles.box, checked ? { backgroundColor: p.primary, borderColor: p.primary } : { backgroundColor: p.surface, borderColor: p.textMuted }]}>
        {checked ? <Icon name="check" size={16} color={p.onPrimary} strokeWidth={3} /> : null}
      </View>
      <Text variant="small" style={styles.flex}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start' },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photo: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2 },
  text: { flex: 1, gap: 6, alignItems: 'flex-start' },
  // The storyboard sets these card descriptions at 13/1.45, and the card titles at the font's normal line height.
  tight: { lineHeight: 19 },
  normal15: { lineHeight: 19 },
  iconNudge: { marginTop: 2 },
  pledgeTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pledgeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, minHeight: 44 },
  box: { width: 22, height: 22, marginTop: 1, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
});
