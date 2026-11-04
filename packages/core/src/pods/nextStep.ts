/**
 * The pod screen's one primary "next step" card (D13), derived from state so the app and any push copy agree:
 * vote → confirm attendance → chat during the window → give feedback.
 */
import { isChatOpen } from '../time/schedule';
import type { AttendanceStatus, PodState } from '../types/domain';

export type PodNextStep = 'vote' | 'confirmAttendance' | 'chat' | 'feedback' | null;

export interface PodNextStepInput {
  readonly state: PodState;
  readonly now: number;
  /** Planning: whether the viewer has voted on every current option. */
  readonly votedOnAllOptions: boolean;
  readonly meetupAt: number | null;
  readonly myAttendance: AttendanceStatus | null;
  /** `stillComing3d` or `stillComing24h`, whichever has passed most recently; null before the first ask. */
  readonly attendanceAskedAt: number | null;
  readonly feedbackGiven: boolean;
}

export function podNextStep(i: PodNextStepInput): PodNextStep {
  switch (i.state) {
    case 'planning':
      return i.votedOnAllOptions ? null : 'vote';
    case 'scheduled': {
      const answered = i.myAttendance === 'coming' || i.myAttendance === 'notComing';
      if (!answered && i.attendanceAskedAt !== null && i.now >= i.attendanceAskedAt) return 'confirmAttendance';
      if (i.meetupAt !== null && isChatOpen(new Date(i.meetupAt), new Date(i.now))) return 'chat';
      return null;
    }
    case 'happened':
      return i.feedbackGiven ? (i.meetupAt !== null && isChatOpen(new Date(i.meetupAt), new Date(i.now)) ? 'chat' : null) : 'feedback';
    default:
      return null;
  }
}
