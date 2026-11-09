import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { usePalette } from '@/components/theme';
import { Badge, Button, Card, Checkbox, ErrorText, Heading, Icon, Small, Text, type IconName } from '@/components/ui';
import { pushPermissionGranted, registerPushToken, requestPushPermission } from '@/features/notifications/push';
import { AuthenticatedPhoto } from '@/features/photos/AuthenticatedPhoto';
import { usePhotoUpload } from '@/features/photos/upload';

const AVATAR = 56;

/**
 * "A photo, so your pod recognises you (optional)" (onb-final; §3.1 step 10): an open seat for your photo (a 56 px
 * Paper disc with a dashed Field ring and an Ink 2 camera), or the photo once the server has published it; "Add a
 * photo" (secondary, camera) opens the picker and uploads (§9 Photos).
 */
export function PhotoStepCard({ uid, version }: { readonly uid: string; readonly version: number | null }) {
  const { t } = useTranslation();
  const p = usePalette();
  const { state, choose } = usePhotoUpload(uid);
  return (
    <Card style={[CARD_PADDING, styles.row]} gap={14}>
      {version !== null ? (
        <AuthenticatedPhoto owner={uid} version={version} size="thumb" accessibilityLabel={t('onboarding.final.yourPhoto')} style={styles.photo} />
      ) : (
        <View style={styles.photo} accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {/* The dashed ring is drawn (RN cannot dash a round border reliably); the camera sits on top of it. */}
          <Svg width={AVATAR} height={AVATAR} style={StyleSheet.absoluteFill}>
            <Circle cx={AVATAR / 2} cy={AVATAR / 2} r={AVATAR / 2 - 1} fill={p.inset} stroke={p.field} strokeWidth={2} strokeDasharray="5 4" />
          </Svg>
          <View style={[StyleSheet.absoluteFill, styles.center]}>
            <Icon name="camera" size={24} strokeWidth={2} color={p.textSecondary} />
          </View>
        </View>
      )}
      <View style={styles.text}>
        <Heading style={styles.title}>
          {t('onboarding.final.photoTitle')}
          <Text variant="heading" weight="500" color="textMuted" style={styles.title}>{` ${t('common.optional')}`}</Text>
        </Heading>
        <Text variant="caption" color="textSecondary" style={styles.body}>
          {t('onboarding.final.photoBody')}
        </Text>
        <View style={styles.action}>
          <Button
            testID="photo-choose"
            label={version === null && state !== 'done' ? t('onboarding.final.addPhoto') : t('onboarding.final.changePhoto')}
            variant="secondary"
            size="sm"
            icon="camera"
            busy={state === 'uploading'}
            onPress={() => void choose()}
          />
        </View>
        {state === 'done' && version === null ? <Small color="textSecondary">{t('onboarding.photo.uploaded')}</Small> : null}
        {state === 'failed' ? <ErrorText>{t('onboarding.photo.failed')}</ErrorText> : null}
      </View>
    </Card>
  );
}

/**
 * "Know when your drop arrives" (onb-final; §3.1 step 11): asks for the notification permission with a secondary
 * button (Finish is the one primary). Pushes never name a theme, a person or what anyone wrote (S4). Saying no is
 * fine; Settings can turn them on later.
 */
export function NotificationsStepCard() {
  const { t } = useTranslation();
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
    <Card style={CARD_PADDING} gap={4}>
      <CardTitle icon="bell" title={t('onboarding.final.notifTitle')} />
      <Text variant="caption" color="textSecondary" style={styles.body}>
        {t('onboarding.final.notifBody')}
      </Text>
      <View style={styles.action}>
        {status === 'on' ? (
          <View testID="notifications-on">
            <Badge label={t('onboarding.final.notifOn')} tone="status" icon="check" />
          </View>
        ) : (
          <Button testID="notifications-enable" label={t('onboarding.final.notifEnable')} variant="secondary" size="sm" icon="bell" busy={busy} onPress={() => void enable()} />
        )}
      </View>
      {status === 'off' ? <Small>{t('onboarding.final.notifOff')}</Small> : null}
    </Card>
  );
}

/** "Our safety pledge" (onb-final; §3.1 step 11): one unticked checkbox, needed to finish. */
export function PledgeCard({ agreed, onChange }: { readonly agreed: boolean; readonly onChange: (agreed: boolean) => void }) {
  const { t } = useTranslation();
  return (
    <Card style={CARD_PADDING} gap={8}>
      <CardTitle icon="shield" title={t('onboarding.final.pledgeTitle')} />
      <Checkbox testID="pledge" label={t('onboarding.final.pledge')} checked={agreed} onChange={onChange} />
    </Card>
  );
}

/** A card's 15/700 title with its 20 px Ink 2 icon, 8 apart (onb-final). */
function CardTitle({ icon, title }: { readonly icon: IconName; readonly title: string }) {
  const p = usePalette();
  return (
    <View style={styles.cardTitle}>
      <Icon name={icon} size={20} strokeWidth={2} color={p.textSecondary} />
      <Heading style={[styles.title, styles.flex]}>{title}</Heading>
    </View>
  );
}

/**
 * onb-final's cards: white, radius 22, 14 / 16 padding. A plain object, not a StyleSheet entry: Card sets its padding
 * inline, and on web only another inline style wins over it.
 */
const CARD_PADDING: ViewStyle = { paddingVertical: 14 };

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  photo: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 4, alignItems: 'flex-start' },
  // The storyboard's card titles are 15/20 and their text 13/18.
  title: { lineHeight: 20 },
  body: { lineHeight: 18 },
  action: { marginTop: 4, alignSelf: 'flex-start' },
  cardTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
});
