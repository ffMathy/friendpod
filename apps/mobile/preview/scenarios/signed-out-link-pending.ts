import type { Scenario } from '../runtime/types';

/** Signed out, after "Send me a sign-in link": the address waits in secure storage until the link is opened. */
const scenario: Scenario = {
  id: 'signed-out-link-pending',
  title: 'Signed out: email link sent, address stored on the phone',
  now: '2026-11-10T12:00:00+01:00',
  user: null,
  secureStore: { 'emailLink.pendingEmail': 'emil@example.com' },
};

export default scenario;
