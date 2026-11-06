import { geohashCentroid, type Gh5, type Place } from '@grouper/core';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { Fonts, Spacing, Type, usePalette } from '@/components/theme';
import { AppText, Body, ChipButton, ErrorText, Field, Icon } from '@/components/ui';
import { getPlaces, PlaceNotPublicError, type PlacePrediction, type PlacesSession } from './index';

const DEBOUNCE_MS = 300;
const MIN_QUERY = 2;

export interface PlacePickerProps {
  readonly language: 'da' | 'en';
  /** The viewer's own cell, to bias results towards the area; never sent to our servers. */
  readonly gh5: Gh5 | null;
  readonly value: Place | null;
  readonly onChange: (place: Place | null) => void;
}

/**
 * Meetup place from Google Places (D8; storyboard 3.3): a search field, then the public places it found in one white
 * list; the picked place is shown in mint with a tick. Public place types only, no free text. One Places session per
 * pick, so the typing and the final details call are billed together. The Google attribution stays visible.
 */
export function PlacePicker({ language, gh5, value, onChange }: PlacePickerProps) {
  const { t } = useTranslation();
  const p = usePalette();
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<readonly PlacePrediction[]>([]);
  const [problem, setProblem] = useState<'notPublic' | 'failed' | null>(null);
  const session = useRef<PlacesSession | null>(null);

  const currentSession = (): PlacesSession => {
    session.current ??= getPlaces().newSession({ language, near: gh5 ? geohashCentroid(gh5) : null });
    return session.current;
  };

  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_QUERY) {
      setPredictions([]);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      currentSession()
        .autocomplete(q)
        .then((rows) => {
          if (!cancelled) setPredictions(rows);
        })
        .catch(() => {
          if (!cancelled) setProblem('failed');
        });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const pick = async (prediction: PlacePrediction) => {
    setProblem(null);
    const s = currentSession();
    session.current = null;
    try {
      onChange(await s.details(prediction.placeId));
      setQuery('');
      setPredictions([]);
    } catch (e) {
      setProblem(e instanceof PlaceNotPublicError ? 'notPublic' : 'failed');
    }
  };

  const attribution = (
    <AppText variant="micro" tone="muted">
      {t('plan.placeAttribution')}
    </AppText>
  );

  if (value) {
    return (
      <View style={styles.picker}>
        <AppText variant="section">{t('plan.place')}</AppText>
        <View style={[styles.list, { borderColor: p.border }]}>
          <View style={[styles.result, { backgroundColor: p.mint }]}>
            <Icon name="pin" size={20} color={p.primary} />
            <View style={styles.resultText}>
              <AppText style={styles.resultName}>{value.name}</AppText>
              <AppText variant="caption" tone="muted">
                {value.address}
              </AppText>
            </View>
            <Icon name="check" size={18} color={p.primary} strokeWidth={2.6} />
          </View>
        </View>
        <ChipButton label={t('plan.changePlace')} size="sm" onPress={() => onChange(null)} />
        {attribution}
      </View>
    );
  }
  return (
    <View style={styles.picker}>
      <Field
        label={t('plan.place')}
        value={query}
        onChangeText={(v) => {
          setProblem(null);
          setQuery(v);
        }}
        placeholder={t('plan.placeHint')}
        hint={t('plan.placeHelp')}
        leadingIcon="search"
        size="md"
        autoCorrect={false}
        returnKeyType="search"
        testID="place-search"
      />
      {predictions.length > 0 ? (
        <View style={[styles.list, { backgroundColor: p.surface, borderColor: p.border }]}>
          {predictions.map((prediction, i) => (
            <Pressable
              key={prediction.placeId}
              accessibilityRole="button"
              accessibilityLabel={`${prediction.name}, ${prediction.secondary}`}
              onPress={() => void pick(prediction)}
              style={({ pressed }) => [
                styles.result,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.divider },
                pressed && { backgroundColor: p.subtle },
              ]}
            >
              <Icon name="pin" size={20} color={p.muted} />
              <View style={styles.resultText}>
                <AppText style={styles.resultName}>{prediction.name}</AppText>
                <AppText variant="caption" tone="muted">
                  {prediction.secondary}
                </AppText>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
      {query.trim().length >= MIN_QUERY && predictions.length === 0 && problem === null ? (
        <Body size="xs" muted>
          {t('plan.placeNoResults')}
        </Body>
      ) : null}
      {problem ? <ErrorText>{t(problem === 'notPublic' ? 'plan.placeNotPublic' : 'plan.placeFailed')}</ErrorText> : null}
      {attribution}
    </View>
  );
}

const styles = StyleSheet.create({
  picker: { gap: Spacing.sm },
  list: { borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  result: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 14 },
  resultText: { flex: 1, gap: 2 },
  resultName: { ...Type.bodyMd, ...Fonts.bold },
});
