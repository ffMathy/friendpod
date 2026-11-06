import { getLaunchArea, waitlistDisplay } from '@grouper/core';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { usePalette } from '@/components/theme';
import { AppText, Banner, Button, Card, Icon, Loading, Pill, Screen, Spacer, StepHeader, Title } from '@/components/ui';
import { useAreaDoc, useUserDoc } from '@/data/docs';
import { registerPushToken, requestPushPermission } from '@/features/notifications/push';
import { PhotoCard } from '@/features/photos/PhotoCard';
import { AboutMeInput, useAboutMe } from '@/features/profile/AboutMeField';
import { InlineCheckbox } from '@/features/profile/InlineCheckbox';
import { useSession, useUid } from '@/features/session/SessionProvider';
import { currentLocale } from '@/i18n';

const STEP = 6;
const STEPS = 6;

/**
 * "Almost done" (storyboard 1.7): §3.1 steps 10–12 on one screen. The optional photo and "about me" (D4), the
 * notification permission (pushes never name a theme or a person, S4), the safety pledge, which Finish needs, and the
 * area's state (live, waitlist progress "N of goal" with "<10" below 10, or not in your area yet). Finish saves a
 * changed "about me" first, then ends onboarding; Home then shows "This week" or the city's waitlist (1.8). Finish
 * follows the content (storyboard 1.7) rather than being pinned, so it comes after the pledge it needs.
 */
export default function AlmostDone() {
  const { t } = useTranslation();
  const router = useRouter();
  const { finishOnboarding } = useSession();
  const uid = useUid();
  const user = useUserDoc(uid);
  if (user.isLoading) return <Loading label={t('common.loading')} />;
  return (
    <AlmostDoneForm
      uid={uid}
      photoVersion={user.data?.photo?.v ?? null}
      aboutMe={user.data?.aboutMe ?? ''}
      areaId={user.data?.area.areaId ?? null}
      onBack={router.back}
      onFinish={finishOnboarding}
    />
  );
}

function AlmostDoneForm({
  uid,
  photoVersion,
  aboutMe: savedAboutMe,
  areaId,
  onBack,
  onFinish,
}: {
  uid: string;
  photoVersion: number | null;
  aboutMe: string;
  areaId: string | null;
  onBack: () => void;
  onFinish: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const aboutMe = useAboutMe(savedAboutMe);
  const [pledged, setPledged] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const finish = async () => {
    setFinishing(true);
    try {
      // An unsaved "about me" would otherwise be lost; a failed save shows its error and keeps the user here.
      await aboutMe.commit();
      await onFinish();
    } catch {
      // The field shows the save error.
    } finally {
      setFinishing(false);
    }
  };

  return (
    <Screen wide gap={18}>
      <StepHeader
        step={STEP}
        total={STEPS}
        stepLabel={t('onboarding.stepOf', { step: STEP, total: STEPS })}
        backLabel={t('common.back')}
        onBack={onBack}
      />
      <Title>{t('onboarding.final.title')}</Title>

      <PhotoCard
        uid={uid}
        version={photoVersion}
        title={t('onboarding.final.photoTitle')}
        optionalLabel={t('common.optional')}
        description={t('onboarding.final.photoBody')}
      />
      <AboutMeInput state={aboutMe} />
      <NotificationsCard />
      <PledgeCard checked={pledged} onChange={setPledged} />
      <AreaStatus areaId={areaId} />
      <Spacer />
      <Button
        testID="onboarding-finish"
        label={t('onboarding.final.finish')}
        variant="accent"
        disabled={!pledged || aboutMe.problem !== null}
        busy={finishing || aboutMe.save.isPending}
        onPress={() => void finish()}
      />
    </Screen>
  );
}

/** "Know when your drop arrives": asks for the permission in place and registers the token (§3.1 step 11). */
function NotificationsCard() {
  const { t } = useTranslation();
  const p = usePalette();
  const [state, setState] = useState<'idle' | 'asking' | 'on' | 'off'>('idle');

  const enable = async () => {
    setState('asking');
    try {
      if (await requestPushPermission()) {
        // A failed registration is retried at the next app start (usePushTokenSync).
        await registerPushToken().catch(() => undefined);
        setState('on');
      } else {
        setState('off');
      }
    } catch {
      // Notifications stay off; the user can enable them later in Settings.
      setState('off');
    }
  };

  return (
    <Card>
      <View style={styles.cardRow}>
        <Icon name="bell" size={24} strokeWidth={1.8} color={p.primary} style={styles.cardIcon} />
        <View style={styles.cardText}>
          <AppText accessibilityRole="header" variant="section">
            {t('onboarding.final.notificationsTitle')}
          </AppText>
          <AppText variant="caption" tone="muted">
            {t('onboarding.final.notificationsBody')}
          </AppText>
          {state === 'on' ? (
            <Pill label={t('onboarding.final.notificationsOn')} tone="mint" icon="check" />
          ) : state === 'off' ? (
            <AppText variant="caption" tone="soft" accessibilityLiveRegion="polite">
              {t('onboarding.final.notificationsOff')}
            </AppText>
          ) : (
            <Button
              testID="notifications-enable"
              label={t('onboarding.notifications.enable')}
              size="xs"
              inline
              busy={state === 'asking'}
              onPress={() => void enable()}
            />
          )}
        </View>
      </View>
    </Card>
  );
}

/** "Our safety pledge" (§3.1 step 11): one unticked checkbox, required to finish; the sentence in regular 14/21. */
function PledgeCard({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  const { t } = useTranslation();
  const p = usePalette();
  return (
    <Card tone="mint">
      <View style={styles.pledgeTitle}>
        <Icon name="shield" size={20} color={p.mintText} />
        <AppText accessibilityRole="header" variant="section" tone="mint">
          {t('onboarding.pledge.title')}
        </AppText>
      </View>
      <InlineCheckbox
        testID="pledge-checkbox"
        variant="statement"
        label={t('onboarding.final.pledgeAgree')}
        checked={checked}
        onChange={onChange}
      />
    </Card>
  );
}

/** §3.1 step 12: the first drop in a live area, the waitlist's progress, or not in your area yet. */
function AreaStatus({ areaId }: { areaId: string | null }) {
  const { t } = useTranslation();
  const area = useAreaDoc(areaId);
  const locale = currentLocale();
  const launchArea = areaId ? getLaunchArea(areaId) : null;
  const label = area.data?.label[locale] ?? launchArea?.label[locale] ?? '';
  const status = area.data?.status ?? launchArea?.status ?? null;
  if (!areaId || !status) {
    return (
      <Banner tone="subtle" icon="pin">
        {t('onboarding.done.outside')}
      </Banner>
    );
  }
  if (status === 'live') {
    return (
      <Banner tone="mint" icon="calendar">
        {t('onboarding.done.live')}
      </Banner>
    );
  }
  return (
    <Banner tone="amber" icon="people">
      {t('onboarding.done.waitlist', {
        area: label,
        n: waitlistDisplay(area.data?.waitlistCount ?? 0),
        goal: area.data?.goal.waitlist ?? launchArea?.goal.waitlist ?? 250,
      })}
    </Banner>
  );
}

const styles = StyleSheet.create({
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  cardIcon: { marginTop: 2 },
  cardText: { flex: 1, gap: 6 },
  pledgeTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
