import { getLaunchArea, waitlistDisplay } from '@grouper/core';
import { useTranslation } from 'react-i18next';
import { Body, Button, Heading, Loading, Screen } from '@/components/ui';
import { useAreaDoc, useUserDoc } from '@/data/docs';
import { AboutMeField } from '@/features/profile/AboutMeField';
import { useSession, useUid } from '@/features/session/SessionProvider';
import { currentLocale } from '@/i18n';

/** §3.1 step 12: live area, waitlist progress ("N of goal", "<10" below 10) or "not in your area yet", and "About me" (D4). */
export default function Done() {
  const { t } = useTranslation();
  const { finishOnboarding } = useSession();
  const user = useUserDoc(useUid());
  const areaId = user.data?.area.areaId ?? null;
  const area = useAreaDoc(areaId);
  const locale = currentLocale();
  if (user.isLoading) return <Loading label={t('common.loading')} />;

  const launchArea = areaId ? getLaunchArea(areaId) : null;
  const label = area.data?.label[locale] ?? launchArea?.label[locale] ?? '';
  const status = area.data?.status ?? launchArea?.status ?? null;
  let message: string;
  if (!areaId || !status) message = t('onboarding.done.outside');
  else if (status === 'live') message = t('onboarding.done.live');
  else
    message = t('onboarding.done.waitlist', {
      area: label,
      n: waitlistDisplay(area.data?.waitlistCount ?? 0),
      goal: area.data?.goal.waitlist ?? launchArea?.goal.waitlist ?? 250,
    });

  return (
    <Screen>
      <Heading>{t('onboarding.done.title')}</Heading>
      <Body>{message}</Body>
      <Body muted>{t('aboutMe.intro')}</Body>
      <AboutMeField initial={user.data?.aboutMe ?? ''} />
      <Button label={t('onboarding.done.go')} onPress={() => void finishOnboarding()} />
    </Screen>
  );
}
