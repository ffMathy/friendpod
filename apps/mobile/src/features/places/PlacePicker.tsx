import { geohashCentroid, type Gh5, type Place } from '@grouper/core';
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
 * Meetup place from Google Places (D8, pod-propose): a search field, then the public places it finds as "name" over
 * "Café · Aarhus C", with the picked one in mint and ticked. Public place types only, no free text and so no "public
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
        <Text variant="smallBold" style={styles.label} accessible={false} importantForAccessibility="no">
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
        <Text variant="caption" color="textMuted" style={styles.helper}>
          {t('plan.placeHelper')}
        </Text>
      </View>
      {rows.length > 0 ? (
        <View style={styles.results}>
          <View accessibilityLabel={t('plan.places')} style={[styles.list, { backgroundColor: p.surface, borderColor: p.border }]}>
            {rows.map((r, i) => {
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
                    { backgroundColor: selected ? p.mint : pressed ? p.surfaceMuted : p.surface },
                    i < rows.length - 1 ? { borderBottomWidth: BorderWidth.hairline, borderBottomColor: p.separator } : null,
                  ]}
                >
                  <Icon name="pin" size={20} color={selected ? p.primary : p.textMuted} />
                  <View style={styles.flex}>
                    <Text variant="heading" style={styles.name}>
                      {r.name}
                    </Text>
                    <Text variant="caption" color="textMuted" style={styles.line}>
                      {[kind(r), r.secondary].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  {selected ? <Icon name="check" size={18} strokeWidth={2.6} color={p.primary} accessibilityLabel={t('plan.selected')} /> : null}
                </Pressable>
              );
            })}
          </View>
          <Text variant="micro" color="textFaint" align="right">
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

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  picker: { gap: 16 },
  // Label, field and helper 6 px apart, the 14 and 13 px lines at their natural line height (the storyboard).
  search: { gap: 6 },
  results: { gap: 6 },
  label: { lineHeight: 18 },
  helper: { lineHeight: 16 },
  name: { lineHeight: 19 },
  line: { lineHeight: 16 },
  list: { borderWidth: BorderWidth.hairline, borderRadius: Radius.xl, overflow: 'hidden' },
  row: { minHeight: 60, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
});
