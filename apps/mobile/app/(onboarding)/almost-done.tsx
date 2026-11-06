import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ErrorText, Loading } from '@/components/ui';
import { useUserDoc } from '@/data/docs';
import { useCallable } from '@/data/useCallable';
import { NotificationsStepCard, PhotoStepCard, PledgeCard } from '@/features/onboarding/FinalStepCards';
import { OnboardingStep, useStepBack } from '@/features/onboarding/OnboardingStep';
import { AboutMeInput, useAboutMe } from '@/features/profile/AboutMeField';
import { useSession, useUid } from '@/features/session/SessionProvider';
import { errorMessageKey } from '@/lib/errors';

/**
 * Step 6 of 6, "Almost done" (onb-final; DESIGN §3.1 steps 10–12): the optional photo and "About me", notifications,
 * and the safety pledge, which Finish needs. Finish saves "About me" if it changed, then ends onboarding: Home is the
 * city's waitlist while the area is not live (city-waitlist), otherwise "This week".
 */
export default function AlmostDone() {
  const { t } = useTranslation();
  const uid = useUid();
  const user = useUserDoc(uid);
  if (user.isLoading) return <Loading label={t('common.loading')} />;
  return <FinalStep uid={uid} photoVersion={user.data?.photo?.v ?? null} aboutMe={user.data?.aboutMe ?? ''} />;
}

function FinalStep({ uid, photoVersion, aboutMe }: { readonly uid: string; readonly photoVersion: number | null; readonly aboutMe: string }) {
  const { t } = useTranslation();
  const back = useStepBack();
  const { finishOnboarding } = useSession();
  const about = useAboutMe(aboutMe);
  const save = useCallable('updateProfile');
  const [pledged, setPledged] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const finish = async () => {
    if (!pledged || about.problem !== null) return;
    setFinishing(true);
    try {
      if (about.changed && about.text !== null) await save.mutateAsync({ aboutMe: about.text });
      await finishOnboarding();
    } catch {
      // The save error is shown under the fields; the user can fix it or clear the field and finish.
    } finally {
      setFinishing(false);
    }
  };

  return (
    <OnboardingStep
      step={6}
      title={t('onboarding.final.title')}
      gap={18}
      onBack={back}
      // Finish needs the pledge, the last card: a pinned button would cover it on a phone, so Finish follows it.
      footerPinned={false}
      footer={
        <Button
          testID="finish"
          label={t('onboarding.final.finish')}
          disabled={!pledged || about.problem !== null}
          busy={finishing}
          onPress={() => void finish()}
        />
      }
    >
      <PhotoStepCard uid={uid} version={photoVersion} />
      <AboutMeInput state={about} />
      {save.error ? <ErrorText>{t(errorMessageKey(save.error))}</ErrorText> : null}
      <NotificationsStepCard />
      <PledgeCard agreed={pledged} onChange={setPledged} />
    </OnboardingStep>
  );
}
