import type { Place } from '@grouper/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking } from 'react-native';
import { Body, Button, ErrorText } from '@/components/ui';
import { addMeetupToCalendar } from './calendar';

export interface LockedPlanProps {
  readonly meetupAt: number;
  readonly place: Place;
}

/**
 * The locked plan (§3.4 Plan, §3.6): place name and address, the map link stored with the option (`mapUrl`, from
 * `googleMapsPlaceUrl`) and "Add to calendar", which opens the system sheet without the theme (D11).
 */
export function LockedPlan({ meetupAt, place }: LockedPlanProps) {
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
    <>
      <Body>{place.name}</Body>
      <Body muted>{place.address}</Body>
      <Button testID="open-map" label={t('pod.openMap')} variant="secondary" onPress={openMap} />
      {mapFailed ? <ErrorText>{t('pod.mapFailed')}</ErrorText> : null}
      <Button testID="add-to-calendar" label={t('pod.addToCalendar')} variant="secondary" onPress={addToCalendar} />
      {calendarFailed ? <ErrorText>{t('pod.calendarFailed')}</ErrorText> : null}
    </>
  );
}
