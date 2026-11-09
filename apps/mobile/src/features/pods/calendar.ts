import { HOUR_MS, type Place } from '@grouper/core';
import { createEventInCalendarAsync } from 'expo-calendar/legacy';

/** The pod's `happened` timer fires 2 h after the start, so that is the event's length too. */
const MEETUP_LENGTH_MS = 2 * HOUR_MS;

export interface CalendarMeetup {
  readonly startsAt: number;
  readonly place: Place;
  /** "Pod meetup": never the theme, which a synced calendar would carry to other devices and services. */
  readonly title: string;
}

/**
 * Opens the system's new-event sheet, pre-filled (D11). The user saves it, or not; Friendpod stores nothing and needs
 * no calendar permission (iOS 17+ presents the sheet out of process; Android sends an insert intent).
 */
export async function addMeetupToCalendar(m: CalendarMeetup): Promise<void> {
  await createEventInCalendarAsync({
    title: m.title,
    startDate: new Date(m.startsAt),
    endDate: new Date(m.startsAt + MEETUP_LENGTH_MS),
    location: `${m.place.name}, ${m.place.address}`,
  });
}
