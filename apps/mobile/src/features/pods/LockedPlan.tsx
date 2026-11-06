import type { Place } from '@grouper/core';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';
import { AppText, Button, Divider, ErrorText, TextLink } from '@/components/ui';
import { currentLocale } from '@/i18n';
import { formatDateTime } from '@/lib/format';
import { addMeetupToCalendar } from './calendar';

export interface LockedPlanProps {
  readonly meetupAt: number;
  readonly place: Place;
  /** Shown under the plan after a hairline (the viewer's calm attendance line on the pod page). */
  readonly children?: ReactNode;
  /** Adds a quiet "Meeting safely" link beside the map link (the safety tips before the meetup, §4.5). */
  readonly onSafety?: () => void;
}

/**
 * The locked plan (§3.4 Plan, §3.6; storyboard 3.4 "Plan" card body): the time, the place name and address, the map
 * link stored with the option (`mapUrl`, from `googleMapsPlaceUrl`) and "Add to calendar", which opens the system
 * sheet without the theme (D11). The caller supplies the card around it.
 */
export function LockedPlan({ meetupAt, place, children, onSafety }: LockedPlanProps) {
  const { t } = useTranslation();
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
      <View style={styles.details}>
        <AppText variant="heading">{formatDateTime(meetupAt, currentLocale())}</AppText>
        <AppText variant="bodySm" tone="soft">
          {place.name}
        </AppText>
        <AppText variant="caption" tone="muted">
          {place.address}
        </AppText>
        <View style={styles.links}>
          <TextLink testID="open-map" label={t('pod.openMap')} size="sm" onPress={openMap} />
          {onSafety ? <TextLink testID="safety-tips" label={t('pod.meetingSafely')} tone="muted" size="sm" onPress={onSafety} /> : null}
        </View>
        {mapFailed ? <ErrorText>{t('pod.mapFailed')}</ErrorText> : null}
      </View>
      <Button testID="add-to-calendar" label={t('pod.addToCalendar')} icon="calendarPlus" variant="secondary" size="sm" onPress={addToCalendar} />
      {calendarFailed ? <ErrorText>{t('pod.calendarFailed')}</ErrorText> : null}
      {children ? (
        <>
          <Divider />
          {children}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  plan: { gap: 12 },
  details: { gap: 3 },
  links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 18, rowGap: 4 },
});
