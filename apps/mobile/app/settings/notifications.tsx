import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking } from 'react-native';
import { Body, Button, ErrorText, Screen } from '@/components/ui';
import { pushPermissionGranted, registerPushToken, requestPushPermission, unregisterPush } from '@/features/notifications/push';

/** Notifications: generic pushes only (S4). Turning them off drops this device's token. */
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
    <Screen>
      <Body>{t('settings.notifications.body')}</Body>
      {granted === true ? (
        <Button label={t('settings.notifications.turnOff')} variant="secondary" onPress={() => void disable()} />
      ) : (
        <Button label={t('settings.notifications.turnOn')} onPress={() => void enable()} />
      )}
      {failed ? <ErrorText>{t('settings.notifications.failed')}</ErrorText> : null}
    </Screen>
  );
}
