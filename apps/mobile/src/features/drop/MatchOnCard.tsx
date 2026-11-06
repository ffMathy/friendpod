import type { UserDoc } from '@grouper/core';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Card, ChipRow, Pill, SectionTitle, AppText } from '@/components/ui';
import { useInterests, useSensitiveInterests } from '@/data/docs';

/** Chips shown before "+N more"; the Interests tab has the full list. */
const MAX_CHIPS = 8;

/**
 * "What we'll match on" (storyboard 2.1): the user's own active interests (starred first) and settings in one line.
 * Private interests appear only as a count with a lock, never by name, so Home shows nothing sensitive at a glance.
 */
export function MatchOnCard({ uid, user }: { uid: string; user: UserDoc }) {
  const { t } = useTranslation();
  const router = useRouter();
  const interests = useInterests(uid);
  const sensitive = useSensitiveInterests(uid);
  const active = (interests.data ?? [])
    .filter((i) => i.data.state === 'active')
    .sort((a, b) => Number(b.data.starred) - Number(a.data.starred));
  const shown = active.slice(0, MAX_CHIPS);
  const more = active.length - shown.length;
  const privateCount = sensitive.data?.length ?? 0;
  const prefs = user.prefs;
  const summary = [
    user.area.label,
    t('prefs.aboutKm', { km: prefs.maxKm }),
    t('home.ages', { min: prefs.ageMin, max: prefs.ageMax }),
    prefs.languages.map((l) => t(`languages.${l}`)).join(', '),
  ]
    .filter((part) => part.length > 0)
    .join(' · ');

  return (
    <Card gap={10}>
      <SectionTitle title={t('home.matchOn')} action={{ label: t('home.edit'), onPress: () => router.navigate('/interests'), testID: 'home-edit-interests' }} />
      {shown.length === 0 && privateCount === 0 ? (
        <AppText variant="caption" tone="muted">
          {t('interests.empty')}
        </AppText>
      ) : (
        <ChipRow gap={6}>
          {shown.map((i) => (
            <Pill key={i.id} tone="mint" size="lg" weight="regular" label={i.data.display} />
          ))}
          {privateCount > 0 ? <Pill tone="violet" size="lg" weight="regular" icon="lock" label={t('home.privateCount', { count: privateCount })} /> : null}
          {more > 0 ? (
            <AppText variant="caption" tone="muted">
              {t('home.moreInterests', { count: more })}
            </AppText>
          ) : null}
        </ChipRow>
      )}
      <AppText variant="caption" tone="muted">
        {summary}
      </AppText>
    </Card>
  );
}
