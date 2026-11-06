import { Redirect } from 'expo-router';

/**
 * Storyboard 1.7 puts the photo, "about me", notifications and the pledge on one screen ("Almost done", done.tsx),
 * so the notification permission (§3.1 step 11) lives there now. This route only sends an older navigation state there.
 */
export default function MergedNotificationsStep() {
  return <Redirect href="/done" />;
}
