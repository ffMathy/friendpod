import type { Place } from '@grouper/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';
import { Fonts } from '@/components/theme';
import { AppText, Card, ErrorText, Pill, TextLink, Toggle } from '@/components/ui';
import { MemberStack, type MemberStackItem } from './MemberCircle';

export interface PlanOptionCardProps {
  readonly id: string;
  /** The option's time, already formatted. */
  readonly when: string;
  readonly place: Place;
  /** Yes votes on the option. */
  readonly yes: number;
  /** Who said yes, for the avatar stack: each in their pod colour, the viewer last as "You". */
  readonly voters: readonly MemberStackItem[];
  /** The option that would win if voting closed now (`winningOption`): a green border and "Leading". */
  readonly leading: boolean;
  readonly mine: 'yes' | 'no' | null;
  readonly onVote: (vote: 'yes' | 'no' | null) => void;
  /** Report another member's option (absent on the viewer's own). */
  readonly onReport?: () => void;
}

/**
 * One meetup option in the planner (§3.5; storyboard 3.2): time, place and map link, who said yes, and the viewer's
 * Yes / No. A second tap on the chosen answer takes the vote back.
 */
export function PlanOptionCard({ id, when, place, yes, voters, leading, mine, onVote, onReport }: PlanOptionCardProps) {
  const { t } = useTranslation();
  const [mapFailed, setMapFailed] = useState(false);
  const openMap = () => {
    setMapFailed(false);
    Linking.openURL(place.mapUrl).catch(() => setMapFailed(true));
  };
  return (
    <Card radius="lg" gap={12} selected={leading} testID={`option-${id}`}>
      <View style={styles.top}>
        <View style={styles.details}>
          <AppText variant="heading">{when}</AppText>
          <AppText variant="bodySm" tone="soft">
            {place.name}
          </AppText>
          <AppText variant="caption" tone="muted">
            {place.address}
          </AppText>
          <View style={styles.links}>
            <TextLink testID={`open-map-${id}`} label={t('pod.openMap')} size="sm" onPress={openMap} />
            {onReport ? (
              <TextLink
                label={t('plan.report')}
                accessibilityLabel={t('plan.reportOption', { place: place.name })}
                tone="muted"
                size="sm"
                role="button"
                onPress={onReport}
              />
            ) : null}
          </View>
          {mapFailed ? <ErrorText>{t('pod.mapFailed')}</ErrorText> : null}
        </View>
        {leading ? <Pill tone="mint" size="sm" label={t('plan.leading')} /> : null}
      </View>
      <View style={styles.bottom}>
        <View style={styles.tally}>
          {voters.length > 0 ? <MemberStack members={voters} size={28} max={4} youLabel={t('chat.you')} /> : null}
          <AppText variant="bodySm" style={Fonts.bold}>
            {t('plan.yesVotes', { count: yes })}
          </AppText>
        </View>
        <View style={styles.votes}>
          <Toggle
            testID={`vote-yes-${id}`}
            label={t('plan.yes')}
            tone="accent"
            value={mine === 'yes'}
            onChange={(on) => onVote(on ? 'yes' : null)}
          />
          <Toggle testID={`vote-no-${id}`} label={t('plan.no')} value={mine === 'no'} onChange={(on) => onVote(on ? 'no' : null)} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  details: { flex: 1, gap: 3 },
  links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 18, rowGap: 4, marginTop: 2 },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  tally: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  votes: { flexDirection: 'row', gap: 6 },
});
