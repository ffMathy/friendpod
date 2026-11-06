import type { Scenario } from '../runtime/types';
import { ME } from './_kit';
import thisWeek from './this-week';

/**
 * Me → Privacy and Delete account as drawn (storyboards 5.3, 5.4): the this-week member (one private interest with
 * consent, same-gender off, a photo, one blocked person), with no data export in progress, so neither screen shows an
 * export state. `this-week` keeps the ready export (app-settings-privacy-export).
 */
const scenario: Scenario = {
  ...thisWeek,
  id: 'privacy-settings',
  title: 'Privacy settings and delete account, no export in progress',
  docs: (ctx) => {
    const base = typeof thisWeek.docs === 'function' ? thisWeek.docs(ctx) : (thisWeek.docs ?? {});
    return Object.fromEntries(Object.entries(base).filter(([path]) => !path.startsWith(`users/${ME}/exports/`)));
  },
};

export default scenario;
