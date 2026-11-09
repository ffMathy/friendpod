import type { Place } from '@friendpod/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, StyleSheet, View, type AccessibilityActionEvent } from 'react-native';
import { Badge, ErrorText, Icon, Text } from '@/components/ui';
import { BorderWidth, Radius, Size, usePalette, usePodColors } from '@/components/theme';
import { currentLocale } from '@/i18n';
import type { PodColor } from '@/lib/podColor';
import { MemberAvatar } from './MemberAvatar';
import { SmallLink } from './parts';
import { meetupWhen } from './time';

export interface PlanOptionCardProps {
  readonly id: string;
  readonly startsAt: number;
  readonly place: Place;
  /** Who said yes, in roster order; the viewer is drawn as "You". */
  readonly yesVoters: readonly { readonly uid: string; readonly firstName: string; readonly photoV: number | null }[];
  /** Every yes vote, including those of members who have since left (they show as a count only). */
  readonly yesCount: number;
  readonly viewer: string;
  readonly mine: 'yes' | 'no' | null;
  /** The option currently ahead (most yes votes, the earlier time on a tie): the Ink "Leading" pill. */
  readonly leading: boolean;
  /** The pod's colour: voters' avatars in its deep tone, the pin in its deep tone (Ink 2 when private). */
  readonly color: PodColor | null;
  /** Press and hold the card, or the screen reader's "Report" action on its title; absent for the viewer's own option. */
  readonly onReport?: () => void;
  readonly onVote: (vote: 'yes' | 'no' | null) => void;
}

/**
 * One time-and-place option (pod-plan): the date in 18/800 with "Leading" in an Ink pill, the place with a pin and
 * "Open map", then under a divider the faces of everyone who said yes with the count, and the viewer's Yes / No (the
 * chosen one filled Ink, with a tick). A second tap on the chosen answer takes the vote back. Another member's option
 * is reported by pressing and holding the card (as a chat message is), or with the "Report" action screen readers
 * offer on its title, so the card shows only what the storyboard shows.
 */
export function PlanOptionCard({ id, startsAt, place, yesVoters, yesCount, viewer, mine, leading, color, onReport, onVote }: PlanOptionCardProps) {
  const { t } = useTranslation();
  const p = usePalette();
  const c = usePodColors(color);
  const locale = currentLocale();
  const [mapFailed, setMapFailed] = useState(false);
  const when = meetupWhen(t, startsAt, locale);
  const openMap = () => {
    setMapFailed(false);
    Linking.openURL(place.mapUrl).catch(() => setMapFailed(true));
  };
  const reportLabel = t('plan.reportOption', { place: place.name });
  return (
    <Pressable testID={`option-${id}`} accessible={false} onLongPress={onReport} delayLongPress={450}>
      <View style={[styles.card, { backgroundColor: p.surface, borderColor: p.border }]}>
        <View style={styles.top}>
          <Text
            testID={`option-title-${id}`}
            accessibilityRole="header"
            variant="cardTitle"
            style={styles.shrink}
            {...(onReport
              ? {
                  accessibilityActions: [{ name: 'report', label: reportLabel }],
                  onAccessibilityAction: (e: AccessibilityActionEvent) => {
                    if (e.nativeEvent.actionName === 'report') onReport();
                  },
                }
              : {})}
          >
            {when}
          </Text>
          {leading ? <Badge tone="status" label={t('plan.leading')} /> : null}
        </View>
        <View style={styles.placeRow}>
          <View style={styles.place}>
            <Icon name="pin" size={16} color={c.icon} />
            <Text variant="small" color="textSecondary" style={styles.shrink}>
              {t('plan.optionPlace', { name: place.name, address: place.address })}
            </Text>
          </View>
          <SmallLink label={t('plan.openMap')} accessibilityLabel={t('pod.openMapAt', { place: place.name })} onPress={openMap} testID={`option-map-${id}`} />
        </View>
        {mapFailed ? <ErrorText>{t('pod.mapFailed')}</ErrorText> : null}
        <View style={[styles.bottom, { borderTopColor: p.separator }]}>
          <View style={styles.count} accessible accessibilityLabel={t('plan.yesVotes', { count: yesCount })}>
            {yesVoters.length > 0 ? (
              <View style={styles.faces}>
                {yesVoters.map((v, i) => (
                  <View key={v.uid} style={i > 0 ? styles.overlap : null}>
                    <MemberAvatar uid={v.uid} name={v.firstName} size={28} photoV={v.photoV} you={v.uid === viewer} color={color} ring />
                  </View>
                ))}
              </View>
            ) : null}
            <Text variant="captionBold" color="textSecondary">
              {t('plan.yesVotes', { count: yesCount })}
            </Text>
          </View>
          <View style={styles.votes} accessibilityLabel={t('plan.yourVote', { when })}>
            <VoteButton testID={`vote-yes-${id}`} label={t('plan.yes')} spoken={t('plan.voteYes', { when })} selected={mine === 'yes'} onPress={() => onVote(mine === 'yes' ? null : 'yes')} />
            <VoteButton testID={`vote-no-${id}`} label={t('plan.no')} spoken={t('plan.voteNo', { when })} selected={mine === 'no'} onPress={() => onVote(mine === 'no' ? null : 'no')} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/** A 44 px Yes / No (pod-plan): white with the 1.5 px Outline; the viewer's answer is filled Ink with a tick. */
function VoteButton({ label, spoken, selected, onPress, testID }: { label: string; spoken: string; selected: boolean; onPress: () => void; testID: string }) {
  const p = usePalette();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.vote,
        selected
          ? { backgroundColor: p.ink, paddingLeft: 12 }
          : { backgroundColor: pressed ? p.page : p.surface, borderWidth: BorderWidth.control, borderColor: p.borderStrong },
      ]}
    >
      {selected ? <Icon name="check" size={14} strokeWidth={2.6} color={p.onInk} /> : null}
      <Text variant="buttonSmall" style={{ color: selected ? p.onInk : p.text }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** "+ Suggest another time (1 spot left)": the dashed 48 px button under the options (pod-plan). */
export function SuggestTimeButton({ label, hint, onPress, testID }: { label: string; hint: string; onPress: () => void; testID?: string }) {
  const p = usePalette();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${hint}`}
      onPress={onPress}
      style={({ pressed }) => [styles.suggest, { borderColor: p.field, backgroundColor: pressed ? p.surface : 'transparent' }]}
    >
      <Icon name="plus" size={18} color={p.text} strokeWidth={2.4} />
      <Text variant="buttonSmall">{label}</Text>
      <Text variant="buttonSmall" weight="500" color="textMuted">
        {hint}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shrink: { flexShrink: 1 },
  card: { borderWidth: BorderWidth.hairline, borderRadius: Radius.card, paddingTop: 14, paddingHorizontal: 14, paddingBottom: 16 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, minHeight: 28 },
  placeRow: { minHeight: Size.hitTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  place: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  bottom: { marginTop: 4, paddingTop: 12, borderTopWidth: BorderWidth.hairline, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  count: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  votes: { flexDirection: 'row', gap: 6 },
  faces: { flexDirection: 'row' },
  overlap: { marginLeft: -10 },
  vote: { height: Size.hitTarget, minWidth: 64, paddingHorizontal: 14, borderRadius: Size.hitTarget / 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  suggest: {
    minHeight: 48,
    borderRadius: 24,
    borderWidth: BorderWidth.control,
    borderStyle: 'dashed',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    alignContent: 'center',
    justifyContent: 'center',
    columnGap: 8,
    rowGap: 2,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
});
