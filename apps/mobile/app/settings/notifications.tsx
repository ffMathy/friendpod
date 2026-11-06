import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';
import { AppText, Button, Card, ErrorText, Screen, ScreenHeader } from '@/components/ui';
import { pushPermissionGranted, registerPushToken, requestPushPermission, unregisterPush } from '@/features/notifications/push';
import { IconBadge } from '@/features/settings/parts';
import { useBack } from '@/features/settings/useBack';

/** Notifications: generic pushes only (S4). Turning them off drops this device's token. */
export default function NotificationSettings() {
  const { t } = useTranslation();
  const back = useBack('/me');
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
    <Screen>
      <ScreenHeader title={t('settings.notifications.title')} backLabel={t('common.back')} onBack={back} />
      <Card>
        <View style={styles.row}>
          <IconBadge icon="bell" tone="mint" size={44} />
          <AppText variant="bodyMd" style={styles.flex}>
            {t('settings.notifications.body')}
          </AppText>
        </View>
      </Card>
      {granted === true ? (
        <Button label={t('settings.notifications.turnOff')} variant="secondary" onPress={() => void disable()} />
      ) : (
        <Button label={t('settings.notifications.turnOn')} icon="bell" onPress={() => void enable()} />
      )}
      {failed ? <ErrorText>{t('settings.notifications.failed')}</ErrorText> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  flex: { flex: 1 },
});
