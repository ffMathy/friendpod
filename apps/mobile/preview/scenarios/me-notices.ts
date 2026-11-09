import type { Scenario } from '../runtime/types';
import { at, ME, ts } from './_kit';
import thisWeek from './this-week';

/**
 * This week's member with one of each kind of message from Friendpod (Me → Messages from Friendpod): the data export is
 * ready, a safety report was received (with the 112 line), an automated no-show pause and its statement of reasons
 * (automated, no human review, the support address), the pause ending, and a member leaving an earlier pod.
 */
const scenario: Scenario = {
  ...thisWeek,
  id: 'me-notices',
  title: 'Messages from Friendpod: one of each kind',
  docs: (ctx) => ({
    ...(typeof thisWeek.docs === 'function' ? thisWeek.docs(ctx) : thisWeek.docs),
    [`users/${ME}/notices/noticeReport`]: {
      type: 'system',
      code: 'REPORT_RECEIVED',
      params: { reportId: 'reportSafety01', category: 'safety' },
      createdAt: ts('2026-11-01 22:40'),
      expiresAt: ts('2027-11-01 22:40'),
    },
    [`users/${ME}/notices/noticeEnded`]: {
      type: 'system',
      code: 'SANCTION_ENDED',
      params: {},
      createdAt: ts('2026-10-26 09:00'),
      expiresAt: ts('2027-10-26 09:00'),
    },
    [`users/${ME}/notices/noticeNoShow`]: {
      type: 'statementOfReasons',
      code: 'PAUSE_NO_SHOW',
      params: { until: at('2026-10-26 09:00'), type: 'pause' },
      createdAt: ts('2026-10-12 09:00'),
      expiresAt: ts('2027-10-12 09:00'),
    },
  }),
};

export default scenario;
