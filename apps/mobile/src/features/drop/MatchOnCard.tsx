import type { InterestDoc, Prefs } from '@grouper/core';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Card, ChipRow, Tag, Text, TextLink } from '@/components/ui';
import type { WithId } from '@/data/live';

/** At most this many interests as tags; the rest are counted ("+3"). */
const MAX_TAGS = 8;

/**
 * "What we'll match on" (drop-home): the viewer's ordinary interests as mint tags, then area, distance, ages and
 * meetup languages. Private interests are left out here: they are only ever a pod's theme, and this card is on the
 * first screen of the app.
 */
export function MatchOnCard({ interests, prefs, areaLabel }: { interests: readonly WithId<InterestDoc>[] | undefined; prefs: Prefs; areaLabel: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const shown = (interests ?? []).slice(0, MAX_TAGS);
  const more = (interests?.length ?? 0) - shown.length;
  const summary = [
    areaLabel,
    t('home.aboutKm', { km: prefs.maxKm }),
    t('home.ages', { min: prefs.ageMin, max: prefs.ageMax }),
    prefs.languages.map((l) => t(`languages.${l}`)).join(', '),
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Card gap={10} testID="match-on">
      {/* The heading row is as tall as its text (no 24 px minimum): "Edit" gets its touch target from hitSlop. */}
      <View style={styles.titleRow}>
        <Text accessibilityRole="header" variant="heading" style={styles.title}>
          {t('home.matchOn')}
        </Text>
        <TextLink compact label={t('home.edit')} onPress={() => router.push('/interests')} />
      </View>
      {shown.length > 0 ? (
        <ChipRow tight>
          {shown.map((i) => (
            <Tag key={i.id} label={i.data.display} />
          ))}
          {more > 0 ? <Tag tone="neutral" label={t('home.moreTags', { count: more })} /> : null}
        </ChipRow>
      ) : interests ? (
        <Text variant="small" color="textSecondary">
          {t('home.noInterests')}
        </Text>
      ) : null}
      <Text variant="caption" color="textMuted" style={styles.summary}>
        {summary}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  // 15 and 13 px at the font's natural line height (1.26), as the storyboard sets none.
  title: { flexShrink: 1, lineHeight: 19 },
  summary: { lineHeight: 16 },
});
