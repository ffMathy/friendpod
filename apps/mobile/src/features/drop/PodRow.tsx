import { DAY_MS, type PodCardDoc, type PodDoc } from '@grouper/core';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { AvatarStack, Icon, PodDot, PodName, Text } from '@/components/ui';
import { BorderWidth, Radius, usePalette } from '@/components/theme';
import { usePod } from '@/data/docs';
import type { WithId } from '@/data/live';
import { isConfirmedMember } from '@/features/pods/membership';
import { currentLocale } from '@/i18n';
import { dsColor, useCardColor } from './color';
import { PodDisc } from './parts';
import { capitalize, clock, dayTime, shortDate, weekday } from './time';

/** "[Bakery café], Frederiksbjerg": the place name and the first part of its short address. */
function placeLabel(place: NonNullable<PodDoc['planning']['place']>): string {
  const first = place.address.split(',')[0]?.trim();
  return first && first !== place.name ? `${place.name}, ${first}` : place.name;
}

/**
 * One of the viewer's pods (drop-home "Your pods", the Pods tab; spec §6.6 pod row): the other members' avatars in the
 * pod's deep tone once confirmed (before that, a disc in the pod's tint), the pod's dot and its name in the viewer's
 * own wording (Bricolage 18/800), where the pod stands, and a chevron. A pod about a private interest stays quiet: a
 * lock instead of the dot, Ink 2 avatars, and the card's 1.5 px Ink border; no colour anywhere.
 */
export function PodRow({ uid, card, now }: { uid: string; card: WithId<PodCardDoc>; now: number }) {
  const { t } = useTranslation();
  const router = useRouter();
  const p = usePalette();
  const locale = currentLocale();
  const c = card.data;
  const pod = usePod(card.id, isConfirmedMember(c)).data;
  const color = useCardColor(uid, card.id, c, pod);
  const isPrivate = color === 'private';
  const theme = c.themeLabel ?? t('pods.openToAnyone');
  const others = pod
    ? pod.memberUids
        .filter((m) => m !== uid)
        .slice(0, 3)
        .map((m) => ({ key: m, name: pod.roster[m]?.firstName ?? '' }))
    : [];

  const meetupAt = pod?.planning.meetupAt?.toMillis();
  const place = pod?.planning.place;
  let detail: string;
  if (c.state === 'proposed') {
    detail =
      c.myStatus === 'accepted'
        ? t('pods.rowWaiting', {
            accepted: c.acceptedCount,
            size: c.sizeTarget,
          })
        : t('pods.rowNew', dayTime(c.acceptBy.toMillis(), locale));
  } else if (c.state === 'planning' && pod) {
    detail = t('pods.rowPlanning', dayTime(pod.planning.deadline.toMillis(), locale));
  } else if (c.state === 'scheduled' && meetupAt !== undefined) {
    // Within the coming week the weekday is enough ("Saturday 14:00"); further out it gets the date.
    const day = meetupAt - now < 6 * DAY_MS ? capitalize(weekday(meetupAt, locale)) : shortDate(meetupAt, locale);
    detail = place
      ? t('pods.rowScheduled', {
          day,
          time: clock(meetupAt, locale),
          place: placeLabel(place),
        })
      : t('pods.rowScheduledNoPlace', { day, time: clock(meetupAt, locale) });
  } else {
    detail = t(`podState.${c.state}`);
  }

  return (
    <Pressable
      testID={`pod-row-${card.id}`}
      accessibilityRole="link"
      accessibilityLabel={`${theme}${c.themeSensitive ? `, ${t('pods.privateInterest')}` : ''}. ${detail}`}
      onPress={() => router.push({ pathname: '/pod/[podId]', params: { podId: card.id } })}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? p.page : p.surface,
          borderColor: isPrivate ? p.privateBorder : p.border,
          borderWidth: isPrivate ? BorderWidth.control : BorderWidth.hairline,
        },
      ]}
    >
      {others.length > 0 ? (
        <AvatarStack people={others} size={28} overlap={10} color={isPrivate ? 'private' : dsColor(color)} />
      ) : (
        <PodDisc color={color} icon={isPrivate ? 'lock' : 'people'} />
      )}
      <View style={styles.text}>
        <View style={styles.titleRow}>
          {isPrivate ? <Icon name="lock" size={14} strokeWidth={2.2} color={p.privateText} /> : <PodDot color={dsColor(color)} />}
          <PodName style={styles.title}>{theme}</PodName>
        </View>
        <Text variant="caption" color="textMuted" style={styles.detail}>
          {detail}
        </Text>
      </View>
      <Icon name="chevronRight" size={20} color={p.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    borderRadius: Radius.card,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  text: { flex: 1, minWidth: 0, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  title: { flexShrink: 1 },
  // 13/18 as drawn.
  detail: { lineHeight: 18 },
});
