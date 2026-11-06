import type { Scenario } from '../runtime/types';

/** Storyboard 1.1: welcome and sign-in, nobody signed in. */
const scenario: Scenario = {
  id: 'signed-out',
  title: 'Signed out: welcome and sign-in',
  now: '2026-11-10T12:00:00+01:00',
  user: null,
};

export default scenario;
