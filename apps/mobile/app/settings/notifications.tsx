import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';
import { Button, Card, ErrorText, Note, StatusText, Text } from '@/components/ui';
import { pushPermissionGranted, registerPushToken, requestPushPermission, unregisterPush } from '@/features/notifications/push';
import { IconBullet, IconHeading, IconListCard, ShellPage } from '@/features/shell/parts';

const SENT = ['drop', 'pod', 'message', 'notice'] as const;

/**
 * Me → Notifications: generic pushes only (S4). The card is onb-final's "Know when your drop arrives" (bell, heading,
 * the promise, then the action, drawn as onb-final draws it: a white secondary "Turn on notifications" with the bell,
 * or once they are on a quiet "Notifications are on" and a white secondary "Turn off in phone settings"). Under it, what a push can say (drop-why's disc bullets) and what it
 * never says (drop-why's "What we never use" info note). Turning them off drops this device's token and opens the
 * phone's settings.
 */
export default function NotificationSettings() {
  const { t } = useTranslation();
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
      <Card gap={10}>
        <IconHeading icon="bell" title={t('settings.notifications.cardTitle')} />
        <Text variant="caption" color="textSecondary">
          {t('settings.notifications.body')}
        </Text>
        {granted === true ? (
          <View style={styles.actions}>
            <View testID="notifications-on">
              <StatusText icon="check" label={t('settings.notifications.on')} />
            </View>
            <Button testID="notifications-off" label={t('settings.notifications.turnOff')} variant="secondary" size="sm" onPress={() => void disable()} />
          </View>
        ) : (
          <View style={styles.actions}>
            <Button testID="notifications-on-button" label={t('settings.notifications.turnOn')} icon="bell" variant="secondary" size="sm" onPress={() => void enable()} />
          </View>
        )}
        {failed ? <ErrorText>{t('settings.notifications.failed')}</ErrorText> : null}
      </Card>

      <IconListCard title={t('settings.notifications.sentTitle')}>
        {SENT.map((k) => (
          <IconBullet key={k} icon="check">
            {t(`settings.notifications.sent.${k}`)}
          </IconBullet>
        ))}
      </IconListCard>

      <Note tone="info" title={t('settings.notifications.neverTitle')}>
        {t('settings.notifications.never')}
      </Note>
    </ShellPage>
  );
}

const styles = StyleSheet.create({
  actions: { gap: 10, alignItems: 'flex-start', marginTop: 2 },
});
