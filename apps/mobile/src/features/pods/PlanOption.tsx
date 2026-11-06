import type { Place } from '@grouper/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, StyleSheet, View, type AccessibilityActionEvent } from 'react-native';
import { Card, ErrorText, Icon, Text } from '@/components/ui';
import { BorderWidth, Radius, Size, typeStyle, usePalette } from '@/components/theme';
import { currentLocale } from '@/i18n';
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
  /** The option currently ahead (most yes votes, the earlier time on a tie): 2 px green border and "Leading". */
  readonly leading: boolean;
  /** Press and hold the card, or the screen reader's "Report" action on its title; absent for the viewer's own option. */
  readonly onReport?: () => void;
  readonly onVote: (vote: 'yes' | 'no' | null) => void;
}

/**
 * One time-and-place option (pod-plan): date in 18/800, place, "Open map", the faces of everyone who said yes with the
 * count, and the viewer's Yes / No. A second tap on the chosen answer takes the vote back. Another member's option is
 * reported by pressing and holding the card (as a chat message is), or with the "Report" action screen readers offer
 * on its title, so the card shows only what the storyboard shows.
 */
export function PlanOptionCard({ id, startsAt, place, yesVoters, yesCount, viewer, mine, leading, onReport, onVote }: PlanOptionCardProps) {
  const { t } = useTranslation();
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
      <Card variant={leading ? 'highlighted' : 'default'} radius={Radius.cardLg} gap={12}>
        <View style={styles.top}>
          <View style={styles.facts}>
            <Text
              testID={`option-title-${id}`}
              accessibilityRole="header"
              variant="cardTitle"
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
            <Text variant="small" color="textSecondary" style={styles.place}>
              {t('plan.optionPlace', { name: place.name, address: place.address })}
            </Text>
            <SmallLink label={t('plan.openMap')} accessibilityLabel={t('pod.openMapAt', { place: place.name })} onPress={openMap} testID={`option-map-${id}`} />
          </View>
          {leading ? <LeadingTag label={t('plan.leading')} /> : null}
        </View>
        {mapFailed ? <ErrorText>{t('pod.mapFailed')}</ErrorText> : null}
        <View style={styles.bottom}>
          <View style={styles.count} accessible accessibilityLabel={t('plan.yesVotes', { count: yesCount })}>
            {yesVoters.length > 0 ? (
              <View style={styles.faces}>
                {yesVoters.map((v, i) => (
                  <View key={v.uid} style={i > 0 ? styles.overlap : null}>
                    <MemberAvatar uid={v.uid} name={v.firstName} size={28} photoV={v.photoV} you={v.uid === viewer} ring />
                  </View>
                ))}
              </View>
            ) : null}
            <Text variant="smallBold">{t('plan.yesVotes', { count: yesCount })}</Text>
          </View>
          <View style={styles.votes} accessibilityLabel={t('plan.yourVote', { when })}>
            <VoteButton testID={`vote-yes-${id}`} label={t('plan.yes')} spoken={t('plan.voteYes', { when })} selected={mine === 'yes'} onPress={() => onVote(mine === 'yes' ? null : 'yes')} />
            <VoteButton testID={`vote-no-${id}`} label={t('plan.no')} spoken={t('plan.voteNo', { when })} selected={mine === 'no'} onPress={() => onVote(mine === 'no' ? null : 'no')} />
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

/** "Leading" (pod-plan): a 26 px mint pill, 10 px a side, 12/800 centred in it. */
function LeadingTag({ label }: { label: string }) {
  const p = usePalette();
  return (
    <View style={[styles.leading, { backgroundColor: p.mint }]}>
      <Text variant="microHeavy" color="onMint" style={styles.leadingText}>
        {label}
      </Text>
    </View>
  );
}

/** A 40 px Yes / No pill (hitSlop to 44): green when it is the viewer's yes, near-black for a no. */
function VoteButton({ label, spoken, selected, onPress, testID }: { label: string; spoken: string; selected: boolean; onPress: () => void; testID: string }) {
  const p = usePalette();
  const yes = testID.startsWith('vote-yes');
  const bg = selected ? (yes ? p.primary : p.ink) : p.surface;
  const fg = selected ? (yes ? p.onPrimary : p.onInk) : p.text;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={(Size.hitTarget - Size.buttonSmall) / 2}
      style={({ pressed }) => [
        styles.vote,
        { backgroundColor: bg, opacity: pressed ? 0.85 : 1 },
        selected ? null : { borderWidth: BorderWidth.hairline, borderColor: p.borderStrong },
      ]}
    >
      <Text style={[typeStyle('smallBold'), { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

/** "+ Suggest another time (1 spot left)": the dashed 54 px row under the options (pod-plan). */
export function SuggestTimeButton({ label, hint, onPress, testID }: { label: string; hint: string; onPress: () => void; testID?: string }) {
  const p = usePalette();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${hint}`}
      onPress={onPress}
      style={({ pressed }) => [styles.suggest, { borderColor: p.borderDashed, backgroundColor: pressed ? p.surfaceMuted : 'transparent' }]}
    >
      <Icon name="plus" size={20} color={p.text} strokeWidth={2.2} />
      <Text variant="heading">{label}</Text>
      <Text variant="heading" weight="500" color="textMuted">
        {hint}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  facts: { flex: 1, gap: 4 },
  // 14 px at its natural line height, as on the storyboard.
  place: { lineHeight: 18 },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  count: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  votes: { flexDirection: 'row', gap: 6 },
  faces: { flexDirection: 'row' },
  overlap: { marginLeft: -8 },
  suggest: {
    minHeight: 54,
    borderRadius: Radius.cardLg,
    borderWidth: BorderWidth.strong,
    borderStyle: 'dashed',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    alignContent: 'center',
    justifyContent: 'center',
    columnGap: 8,
    rowGap: 2,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  leading: { height: 26, paddingHorizontal: 10, borderRadius: 13, justifyContent: 'center', flexShrink: 0 },
  // 12 px at its natural line height, so the word sits in the middle of the pill as in the storyboard's inline-flex.
  leadingText: { lineHeight: 15 },
  // Sized by the word, 14 px a side, as the storyboard's pills; never under 44 wide, so "Ja" keeps the touch target.
  vote: { height: Size.buttonSmall, paddingHorizontal: 14, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center', minWidth: Size.hitTarget },
});
