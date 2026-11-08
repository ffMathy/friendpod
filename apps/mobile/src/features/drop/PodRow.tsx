import { DAY_MS, type PodCardDoc, type PodDoc } from '@grouper/core';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { AvatarStack, Icon, Text } from '@/components/ui';
import { BorderWidth, Radius, usePalette } from '@/components/theme';
import { usePod } from '@/data/docs';
import type { WithId } from '@/data/live';
import { isConfirmedMember } from '@/features/pods/membership';
import { currentLocale } from '@/i18n';
import { capitalize, clock, dayTime, shortDate, weekday } from './time';

/** "[Bakery café], Frederiksbjerg": the place name and the first part of its short address. */
function placeLabel(place: NonNullable<PodDoc['planning']['place']>): string {
  const first = place.address.split(',')[0]?.trim();
  return first && first !== place.name ? `${place.name}, ${first}` : place.name;
}

/**
 * One of the viewer's pods (drop-home "Your pods", the Pods tab): the other members' initials once confirmed, the
 * theme in the viewer's own wording (a lock on a private interest), and where the pod stands.
 */
export function PodRow({ uid, card, now }: { uid: string; card: WithId<PodCardDoc>; now: number }) {
  const { t } = useTranslation();
  const router = useRouter();
  const p = usePalette();
  const locale = currentLocale();
  const c = card.data;
  const pod = usePod(card.id, isConfirmedMember(c)).data;
  const theme = c.themeLabel ?? t('pods.openToAnyone');
  const others = pod
    ? pod.memberUids
        .filter((m) => m !== uid)
        .slice(0, 3)
        .map((m) => ({ key: m, name: pod.roster[m]?.firstName ?? '', seed: m }))
    : [];

  const meetupAt = pod?.planning.meetupAt?.toMillis();
  const place = pod?.planning.place;
  let detail: string;
  if (c.state === 'proposed') {
    detail = c.myStatus === 'accepted' ? t('pods.rowWaiting', { accepted: c.acceptedCount, size: c.sizeTarget }) : t('pods.rowNew', dayTime(c.acceptBy.toMillis(), locale));
  } else if (c.state === 'planning' && pod) {
    detail = t('pods.rowPlanning', dayTime(pod.planning.deadline.toMillis(), locale));
  } else if (c.state === 'scheduled' && meetupAt !== undefined) {
    // Within the coming week the weekday is enough ("Saturday 14:00"); further out it gets the date.
    const day = meetupAt - now < 6 * DAY_MS ? capitalize(weekday(meetupAt, locale)) : shortDate(meetupAt, locale);
    detail = place ? t('pods.rowScheduled', { day, time: clock(meetupAt, locale), place: placeLabel(place) }) : t('pods.rowScheduledNoPlace', { day, time: clock(meetupAt, locale) });
  } else {
    detail = t(`podState.${c.state}`);
  }

  return (
    <Pressable
      testID={`pod-row-${card.id}`}
      accessibilityRole="link"
      accessibilityLabel={`${theme}${c.themeSensitive ? `, ${t('pods.privateInterest')}` : ''}. ${detail}`}
      onPress={() => router.push({ pathname: '/pod/[podId]', params: { podId: card.id } })}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? p.inset : p.surface, borderColor: c.themeSensitive ? p.privateBorder : p.border }]}
    >
      {others.length > 0 ? (
        <AvatarStack people={others} size={32} overlap={10} />
      ) : (
        <View style={[styles.placeholder, { backgroundColor: c.themeSensitive ? p.privateBg : p.inset }]}>
          <Icon name={c.themeSensitive ? 'lock' : 'people'} size={18} color={c.themeSensitive ? p.privateText : p.textSecondary} />
        </View>
      )}
      <View style={styles.text}>
        <View style={styles.titleRow}>
          {c.themeSensitive && others.length > 0 ? <Icon name="lock" size={14} color={p.privateText} /> : null}
          <Text variant="heading" style={styles.title}>
            {theme}
          </Text>
        </View>
        <Text variant="caption" color="textMuted" style={styles.detail}>
          {detail}
        </Text>
      </View>
      {/*
        The storyboard's 20 px chevron has no flex-shrink: 0, so the wrapping place line squeezes it to about 16 px
        (a 5 × 10 stroke ending 5 px from the padding). Drawn at 16 it looks the same and leaves the text that room.
      */}
      <Icon name="chevronRight" size={16} color={p.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    borderWidth: BorderWidth.hairline,
    borderRadius: Radius.card,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  placeholder: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // 15 and 13 px at the font's natural line height (1.26), as the storyboard sets none.
  title: { flexShrink: 1, lineHeight: 19 },
  detail: { lineHeight: 16 },
});
