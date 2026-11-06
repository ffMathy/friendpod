import { Redirect } from 'expo-router';

/** The date of birth is now asked on "About you" together with the first name (storyboard 1.2, `name.tsx`). */
export default function DateOfBirth() {
  return <Redirect href="/name" />;
}
