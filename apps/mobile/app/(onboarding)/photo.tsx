import { Redirect } from 'expo-router';

/**
 * Storyboard 1.7 puts the photo, "about me", notifications and the pledge on one screen ("Almost done", done.tsx),
 * so the optional photo (§3.1 step 10) lives there now. This route only sends an older navigation state there.
 */
export default function MergedPhotoStep() {
  return <Redirect href="/done" />;
}
