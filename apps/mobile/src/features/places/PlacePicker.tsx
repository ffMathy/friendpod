import { geohashCentroid, type Gh5, type Place } from '@grouper/core';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { Fonts, Spacing, Type, usePalette } from '@/components/theme';
import { AppText, Body, ErrorText, Field, Icon } from '@/components/ui';
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
 * list. The picked place is marked in that list in mint with a green pin and a tick, and the other results stay, so a
 * tap on another one switches the pick; a new search keeps the picked place at the top until another is chosen.
 * Public place types only, no free text. Each Places session ends with the details call of a pick, so the typing and
 * the first pick are billed together; switching to another result is one more details call. The Google attribution
 * stays visible.
 */
export function PlacePicker({ language, gh5, value, onChange }: PlacePickerProps) {
  const { t } = useTranslation();
  const p = usePalette();
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<readonly PlacePrediction[]>([]);
  const [problem, setProblem] = useState<'notPublic' | 'failed' | null>(null);
  /** A details call in flight: further taps wait for it. */
  const [fetching, setFetching] = useState(false);
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
    if (fetching || prediction.placeId === value?.placeId) return;
    setProblem(null);
    setFetching(true);
    const s = currentSession();
    session.current = null;
    try {
      onChange(await s.details(prediction.placeId));
    } catch (e) {
      setProblem(e instanceof PlaceNotPublicError ? 'notPublic' : 'failed');
    } finally {
      setFetching(false);
    }
  };

  // The picked place stays listed (first) when a newer search did not return it.
  const listed = value !== null && predictions.some((prediction) => prediction.placeId === value.placeId);
  const rows: readonly PlacePrediction[] =
    value && !listed ? [{ placeId: value.placeId, name: value.name, secondary: value.address }, ...predictions] : predictions;

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
      {rows.length > 0 ? (
        <View style={[styles.list, { backgroundColor: p.surface, borderColor: p.border }]}>
          {rows.map((row, i) => {
            const selected = row.placeId === value?.placeId;
            return (
              <Pressable
                key={row.placeId}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${row.name}, ${row.secondary}`}
                onPress={() => void pick(row)}
                testID={`place-${row.placeId}`}
                style={({ pressed }) => [
                  styles.result,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.divider },
                  selected ? { backgroundColor: p.mint } : pressed && { backgroundColor: p.subtle },
                ]}
              >
                <Icon name="pin" size={20} color={selected ? p.primary : p.muted} />
                <View style={styles.resultText}>
                  <AppText style={styles.resultName}>{row.name}</AppText>
                  <AppText variant="caption" tone="muted">
                    {row.secondary}
                  </AppText>
                </View>
                {selected ? <Icon name="check" size={18} color={p.primary} strokeWidth={2.6} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {query.trim().length >= MIN_QUERY && predictions.length === 0 && problem === null ? (
        <Body size="xs" muted>
          {t('plan.placeNoResults')}
        </Body>
      ) : null}
      {problem ? <ErrorText>{t(problem === 'notPublic' ? 'plan.placeNotPublic' : 'plan.placeFailed')}</ErrorText> : null}
      <AppText variant="micro" tone="muted">
        {t('plan.placeAttribution')}
      </AppText>
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
