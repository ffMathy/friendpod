import { geohashCentroid, type Gh5, type Place } from '@friendpod/core';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { ErrorText, Field, Icon, Text } from '@/components/ui';
import { BorderWidth, Radius, usePalette } from '@/components/theme';
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
 * Meetup place from Google Places (D8, pod-propose): a search field, then the public places it finds as option cards,
 * "name" over "Café · Aarhus C", the picked one with a 2 px Skov border and a tick. Public place types only, no free text and so no "public
 * place" tick. One Places session per pick, so the typing and the final details call are billed together. Google's
 * attribution line sits under the results, as Places data shown without a map requires.
 */
export function PlacePicker({ language, gh5, value, onChange }: PlacePickerProps) {
  const { t } = useTranslation();
  const p = usePalette();
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<readonly PlacePrediction[]>([]);
  const [problem, setProblem] = useState<'notPublic' | 'failed' | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
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
    if (value?.placeId === prediction.placeId) return;
    setProblem(null);
    setPicking(prediction.placeId);
    const s = currentSession();
    session.current = null;
    try {
      onChange(await s.details(prediction.placeId));
    } catch (e) {
      setProblem(e instanceof PlaceNotPublicError ? 'notPublic' : 'failed');
    } finally {
      setPicking(null);
    }
  };

  // The picked place stays at the top of the list, also once the search text changes.
  const rows: readonly PlacePrediction[] =
    value && !predictions.some((r) => r.placeId === value.placeId)
      ? [{ placeId: value.placeId, name: value.name, secondary: value.address, type: value.type }, ...predictions]
      : predictions;
  const searched = query.trim().length >= MIN_QUERY;
  // "Café · Aarhus C": the kind of place, then where (Google's secondary text, the address once picked).
  const kind = (r: PlacePrediction) => (r.type ? t(`plan.placeTypes.${r.type}`) : null);

  return (
    <View style={styles.picker}>
      <View style={styles.search}>
        <Text variant="heading" style={styles.label} accessible={false} importantForAccessibility="no">
          {t('plan.place')}
        </Text>
        <Field
          label={t('plan.place')}
          labelHidden
          size="md"
          icon="search"
          value={query}
          onChangeText={(v) => {
            setProblem(null);
            setQuery(v);
          }}
          placeholder={t('plan.placeHint')}
          accessibilityHint={t('plan.placeHelper')}
          autoCorrect={false}
          returnKeyType="search"
          testID="place-search"
        />
        <Text variant="captionStrong" weight="400" color="textMuted">
          {t('plan.placeHelper')}
        </Text>
      </View>
      {rows.length > 0 ? (
        <View style={styles.results}>
          {/* Each place is a selectable option card (spec §6.6): white, 1.5 px Outline; picked: 2 px Skov and a tick. */}
          <View accessibilityLabel={t('plan.places')} style={styles.list}>
            {rows.map((r) => {
              const selected = value?.placeId === r.placeId;
              return (
                <Pressable
                  key={r.placeId}
                  testID={`place-${r.placeId}`}
                  accessibilityRole="button"
                  accessibilityLabel={[r.name, kind(r), r.secondary].filter(Boolean).join(', ')}
                  accessibilityState={{ selected, busy: picking === r.placeId }}
                  onPress={() => void pick(r)}
                  style={({ pressed }) => [
                    styles.row,
                    selected
                      ? { borderWidth: BorderWidth.strong, borderColor: p.primary, backgroundColor: p.surface, ...PICKED_PADDING }
                      : { borderWidth: BorderWidth.control, borderColor: p.borderStrong, backgroundColor: pressed ? p.page : p.surface },
                  ]}
                >
                  <Icon name="pin" size={20} color={p.textSecondary} />
                  <View style={styles.flex}>
                    <Text variant="heading" style={styles.name}>
                      {r.name}
                    </Text>
                    <Text variant="captionStrong" weight="400" color="textMuted">
                      {[kind(r), r.secondary].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  {selected ? <Icon name="check" size={20} strokeWidth={2.6} color={p.primary} accessibilityLabel={t('plan.selected')} /> : null}
                </Pressable>
              );
            })}
          </View>
          <Text variant="micro" color="textMuted" align="right">
            {t('plan.placeAttribution')}
          </Text>
        </View>
      ) : null}
      {searched && predictions.length === 0 && problem === null && !value ? (
        <Text variant="caption" color="textMuted">
          {t('plan.placeNoResults')}
        </Text>
      ) : null}
      {problem ? <ErrorText>{t(problem === 'notPublic' ? 'plan.placeNotPublic' : 'plan.placeFailed')}</ErrorText> : null}
    </View>
  );
}

/** The option cards' padding: 14 a side inside the 1.5 px Outline (the picked card's 2 px border takes 0.5 of it). */
const ROW_PADDING = 10.5;
/**
 * The picked card's padding, both axes given so they replace the row's own (a bare `padding` loses to
 * `paddingHorizontal` on native and wins over it on web): the pin and the name stay where they were.
 */
const PICKED_PADDING = { paddingVertical: ROW_PADDING - 0.5, paddingHorizontal: ROW_PADDING + 4 - 0.5 } as const;

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  // The storyboard's 18 px between the helper line and the results, and 18 above the Place label (the propose screen's
  // gap is 16, so 2 more here, as the Day and Time row above does).
  picker: { gap: 18, marginTop: 2 },
  // Label, field and helper 6 px apart (the storyboard).
  search: { gap: 6 },
  results: { gap: 8 },
  label: { lineHeight: 20 },
  name: { lineHeight: 20 },
  list: { gap: 8 },
  row: { minHeight: 64, borderRadius: Radius.lg, paddingVertical: ROW_PADDING, paddingHorizontal: ROW_PADDING + 4, flexDirection: 'row', alignItems: 'center', gap: 12 },
});
