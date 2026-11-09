import type { Place } from '@friendpod/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';
import { ErrorText, Icon, Overline, Text } from '@/components/ui';
import { usePodColors } from '@/components/theme';
import { currentLocale } from '@/i18n';
import type { PodColor } from '@/lib/podColor';
import { addMeetupToCalendar } from './calendar';
import { CardButton, SmallLink } from './parts';
import { meetupWhen } from './time';

export interface LockedPlanProps {
  readonly meetupAt: number;
  readonly place: Place;
  /** The pod's colour: the pin before the place is in its deep tone (Ink 2 in a private pod). */
  readonly color: PodColor | null;
  /**
   * The meetup has started or is over (`meetupAt` passed, or the pod has `happened`): the date and place stay as a
   * plain record, without "Open in Maps" or "Add to calendar".
   */
  readonly past?: boolean;
}

/**
 * The locked plan (§3.4 Plan, §3.6; pod-scheduled "PLAN" card): "Saturday 14 Nov, 14:00", the place with a pin,
 * then "Open in Maps" (the map link stored with the option, `mapUrl`) and "Add to calendar" (one tap to the system
 * sheet, without the theme, D11) side by side. Once the meetup is past, only the date and the place are left.
 */
export function LockedPlan({ meetupAt, place, color, past = false }: LockedPlanProps) {
  const { t } = useTranslation();
  const c = usePodColors(color);
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
        <View style={styles.placeRow}>
          <Icon name="pin" size={16} color={c.icon} />
          <Text variant="small" color="textSecondary" style={styles.shrink}>
            {t('plan.placeLine', { name: place.name, address: place.address })}
          </Text>
        </View>
      </View>
      {past ? null : (
        <View style={styles.actions}>
          <CardButton
            testID="open-map"
            height={44}
            icon="pin"
            label={t('pod.openMap')}
            accessibilityLabel={t('pod.openMapAt', { place: place.name })}
            accessibilityRole="link"
            onPress={openMap}
          />
          <CardButton testID="add-to-calendar" height={44} icon="calendarAdd" label={t('pod.addToCalendar')} onPress={addToCalendar} />
        </View>
      )}
      {mapFailed ? <ErrorText>{t('pod.mapFailed')}</ErrorText> : null}
      {calendarFailed ? <ErrorText>{t('pod.calendarFailed')}</ErrorText> : null}
    </View>
  );
}

/**
 * The Plan card's heading row: "PLAN", and at its right "Meeting safely" while the meetup is ahead (the tips come with
 * "Still coming?", §3.6, §4.5), set small so the card keeps the storyboard's height.
 */
export function PlanCardHeader({ onSafety }: { onSafety?: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.header}>
      <Overline>{t('pod.sections.plan')}</Overline>
      {onSafety ? <SmallLink testID="safety-tips" icon="shield" variant="captionBold" compact label={t('pod.safety.title')} onPress={onSafety} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // As tall as the 16 px eyebrow: the link's taller line overhangs it (its target is made up by hitSlop), so the card
  // keeps the storyboard's height.
  header: { height: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  shrink: { flexShrink: 1 },
  plan: { gap: 6 },
  facts: { gap: 2 },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
});
