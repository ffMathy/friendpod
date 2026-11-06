import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';
import { usePalette } from '@/components/theme';
import { Badge, Button, Card, ErrorText, Heading, Icon, Text } from '@/components/ui';
import { pushPermissionGranted, registerPushToken, requestPushPermission, unregisterPush } from '@/features/notifications/push';
import { IconBullet, IconListCard, NoteBox, ShellPage } from '@/features/shell/parts';

const SENT = ['drop', 'pod', 'message', 'notice'] as const;

/**
 * Me → Notifications: generic pushes only (S4). The card is onb-final's "Know when your drop arrives"; under it, what
 * a push can say and what it never says (drop-why's list and "What we never use" box). Turning them off drops this
 * device's token and opens the phone's settings.
 */
export default function NotificationSettings() {
  const { t } = useTranslation();
  const p = usePalette();
  const [granted, setGranted] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void pushPermissionGranted().then(setGranted);
  }, []);

  const enable = async () => {
    setFailed(false);
    try {
      const ok = await requestPushPermission();
      if (ok) await registerPushToken();
      else await Linking.openSettings();
      setGranted(ok);
    } catch {
      setFailed(true);
    }
  };

  const disable = async () => {
    setFailed(false);
    try {
      await unregisterPush();
      await Linking.openSettings();
    } catch {
      setFailed(true);
    }
  };

  return (
    <ShellPage title={t('settings.notifications.title')} eyebrow={t('tabs.me')} testID="notifications">
      <Card gap={14} style={styles.row}>
        <Icon name="bell" size={24} color={p.primary} style={styles.iconNudge} />
        <View style={styles.text}>
          <Heading>{t('settings.notifications.cardTitle')}</Heading>
          <Text variant="caption" color="textMuted" style={styles.tight}>
            {t('settings.notifications.body')}
          </Text>
          {granted === true ? (
            <>
              <View testID="notifications-on">
                <Badge tone="mint" icon="check" label={t('settings.notifications.on')} />
              </View>
              <Button testID="notifications-off" label={t('settings.notifications.turnOff')} variant="outline" size="xs" onPress={() => void disable()} />
            </>
          ) : (
            <Button testID="notifications-on-button" label={t('settings.notifications.turnOn')} variant="dark" size="xs" onPress={() => void enable()} />
          )}
          {failed ? <ErrorText>{t('settings.notifications.failed')}</ErrorText> : null}
        </View>
      </Card>

      <IconListCard title={t('settings.notifications.sentTitle')}>
        {SENT.map((k) => (
          <IconBullet key={k} icon="check">
            {t(`settings.notifications.sent.${k}`)}
          </IconBullet>
        ))}
      </IconListCard>

      <NoteBox title={t('settings.notifications.neverTitle')}>{t('settings.notifications.never')}</NoteBox>
    </ShellPage>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  iconNudge: { marginTop: 2 },
  text: { flex: 1, gap: 6, alignItems: 'flex-start' },
  // onb-final sets these card descriptions at 13/1.45.
  tight: { lineHeight: 19 },
});
