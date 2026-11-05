import { geohashCentroid, type Gh5, type Place } from '@grouper/core';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Body, Card, ChipButton, ErrorText, Field, LinkRow } from '@/components/ui';
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
 * Meetup place from Google Places (D8): public place types only, no free text. One Places session per pick, so the
 * typing and the final details call are billed together.
 */
export function PlacePicker({ language, gh5, value, onChange }: PlacePickerProps) {
  const { t } = useTranslation();
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

  const pick = async (p: PlacePrediction) => {
    setProblem(null);
    const s = currentSession();
    session.current = null;
    try {
      onChange(await s.details(p.placeId));
      setQuery('');
      setPredictions([]);
    } catch (e) {
      setProblem(e instanceof PlaceNotPublicError ? 'notPublic' : 'failed');
    }
  };

  if (value) {
    return (
      <Card>
        <Body bold>{value.name}</Body>
        <Body muted>{value.address}</Body>
        <ChipButton label={t('plan.changePlace')} onPress={() => onChange(null)} />
      </Card>
    );
  }
  return (
    <View style={{ gap: 8 }}>
      <Field
        label={t('plan.place')}
        value={query}
        onChangeText={(v) => {
          setProblem(null);
          setQuery(v);
        }}
        placeholder={t('plan.placeHint')}
        autoCorrect={false}
        testID="place-search"
      />
      {predictions.map((p) => (
        <LinkRow key={p.placeId} label={p.name} detail={p.secondary} onPress={() => void pick(p)} />
      ))}
      {query.trim().length >= MIN_QUERY && predictions.length === 0 && problem === null ? <Body muted>{t('plan.placeNoResults')}</Body> : null}
      {problem ? <ErrorText>{t(problem === 'notPublic' ? 'plan.placeNotPublic' : 'plan.placeFailed')}</ErrorText> : null}
      <Body muted>{t('plan.placeAttribution')}</Body>
    </View>
  );
}
