import type { SetParticipationMode } from '@grouper/core';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Body, Card, ChipRow, ErrorText, Heading, LinkRow, Loading, Screen, Toggle } from '@/components/ui';
import { useUserDoc } from '@/data/docs';
import { useCallable } from '@/data/useCallable';
import { AboutMeField } from '@/features/profile/AboutMeField';
import { useUid } from '@/features/session/SessionProvider';
import { currentLocale, initI18n } from '@/i18n';
import { errorMessageKey } from '@/lib/errors';
import { isUserSettingReason } from '@/lib/reasons';

const MODES: readonly SetParticipationMode[] = ['auto', 'manual', 'skipNext', 'pause'];

/** Me (§11): profile ("About me", D4), preferences, participation, the user's own reliability record, blocking setting. */
export default function Me() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useUserDoc(useUid());
  const participation = useCallable('setParticipation');
  const updateProfile = useCallable('updateProfile');
  if (!user.data) return <Loading label={t('common.loading')} />;
  const u = user.data;
  const locale = currentLocale();
  const attended = u.stats.attended;
  const meetups = attended + u.stats.noShows;
  const lastReason = u.lastDrop?.outcome === 'unmatched' ? u.lastDrop.reason : undefined;
  const blocking = isUserSettingReason(lastReason) ? lastReason : null;
  const paused = u.participation.pausedUntil !== undefined || u.status === 'paused';
  const activeMode: SetParticipationMode = paused ? 'pause' : u.participation.mode;

  return (
    <Screen>
      <Heading>{u.firstName}</Heading>
      <Body muted>{u.area.label}</Body>

      <Card>
        <Body muted>{t('aboutMe.intro')}</Body>
        <AboutMeField initial={u.aboutMe ?? ''} />
      </Card>

      <Card>
        <Body bold>{t('me.participation')}</Body>
        <ChipRow>
          {MODES.map((mode) => (
            <Toggle key={mode} label={t(`me.modes.${mode}`)} value={activeMode === mode} onChange={() => participation.mutate({ mode })} />
          ))}
        </ChipRow>
        {participation.data ? <Body muted>{t('me.effectiveFrom', { week: participation.data.effectiveWeekId })}</Body> : null}
        {participation.error ? <ErrorText>{t(errorMessageKey(participation.error))}</ErrorText> : null}
      </Card>

      <Card>
        <Body bold>{t('me.record')}</Body>
        <Body>{meetups === 0 ? t('me.noMeetupsYet') : t('me.attended', { attended, total: meetups })}</Body>
      </Card>

      {blocking ? (
        <Card>
          <Body>{t(`blockingSetting.${blocking}`)}</Body>
        </Card>
      ) : null}

      <Card>
        <Body bold>{t('me.language')}</Body>
        <ChipRow>
          {(['da', 'en'] as const).map((l) => (
            <Toggle
              key={l}
              label={t(`languages.${l}`)}
              value={locale === l}
              onChange={() => updateProfile.mutate({ locale: l }, { onSuccess: () => initI18n(l) })}
            />
          ))}
        </ChipRow>
      </Card>

      <LinkRow label={t('me.preferences')} onPress={() => router.push('/settings/preferences')} />
      <LinkRow label={t('me.settings')} onPress={() => router.push('/settings')} />
      <LinkRow label={t('info.howMatchingWorks.title')} onPress={() => router.push('/info/how-matching-works')} />
      <LinkRow label={t('info.safety.title')} onPress={() => router.push('/info/safety')} />
    </Screen>
  );
}
