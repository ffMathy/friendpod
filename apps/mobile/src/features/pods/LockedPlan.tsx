import type { Place } from '@grouper/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';
import { Button, ErrorText, Text } from '@/components/ui';
import { currentLocale } from '@/i18n';
import { addMeetupToCalendar } from './calendar';
import { SmallLink } from './parts';
import { meetupWhen } from './time';

export interface LockedPlanProps {
  readonly meetupAt: number;
  readonly place: Place;
  /** "Meeting safely" beside the map link, on the pod page (the tips come with "Still coming?", §3.6). */
  readonly onSafety?: () => void;
  /**
   * The meetup has started or is over (`meetupAt` passed, or the pod has `happened`): the date and place stay as a
   * plain record, without "Open in Maps", "Meeting safely" or "Add to calendar".
   */
  readonly past?: boolean;
}

/**
 * The locked plan (§3.4 Plan, §3.6; pod-scheduled "PLAN" card): "Saturday 14 Nov, 14:00", place name and address,
 * the map link stored with the option (`mapUrl`, from `googleMapsPlaceUrl`) and "Add to calendar", one tap to the
 * system sheet without the theme (D11). Once the meetup is past, only the date and the place are left.
 */
export function LockedPlan({ meetupAt, place, onSafety, past = false }: LockedPlanProps) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const [calendarFailed, setCalendarFailed] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const addToCalendar = () => {
    setCalendarFailed(false);
    addMeetupToCalendar({ startsAt: meetupAt, place, title: t('pod.calendarTitle') }).catch(() => setCalendarFailed(true));
  };
  const openMap = () => {
    setMapFailed(false);
    Linking.openURL(place.mapUrl).catch(() => setMapFailed(true));
  };
  return (
    <View style={styles.plan}>
      <View style={styles.facts}>
        <Text variant="cardTitle">{meetupWhen(t, meetupAt, locale)}</Text>
        <Text variant="small" color="textSecondary" style={styles.place}>
          {t('plan.placeLine', { name: place.name, address: place.address })}
        </Text>
        {past ? null : (
          <View style={styles.links}>
            <SmallLink testID="open-map" label={t('pod.openMap')} accessibilityLabel={t('pod.openMapAt', { place: place.name })} onPress={openMap} />
            {onSafety ? <SmallLink testID="safety-tips" icon="shield" underline={false} label={t('pod.safety.title')} onPress={onSafety} /> : null}
          </View>
        )}
      </View>
      {mapFailed ? <ErrorText>{t('pod.mapFailed')}</ErrorText> : null}
      {past ? null : <Button testID="add-to-calendar" label={t('pod.addToCalendar')} icon="calendarAdd" variant="outline" size="sm" fullWidth onPress={addToCalendar} />}
      {calendarFailed ? <ErrorText>{t('pod.calendarFailed')}</ErrorText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  plan: { gap: 12 },
  facts: { gap: 3 },
  // 14 px at its natural line height, as on the storyboard.
  place: { lineHeight: 18 },
  links: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
});
