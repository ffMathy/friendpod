/**
 * Attendance around a scheduled meetup (D5) and "Who was there?" after it (D15). Pure: the sweeper and
 * confirmAttendance apply these inside their podState transaction.
 */
import type { AttendanceStatus } from '../types/domain';
import type { Uid } from '../types/ids';

/** Fewer members than this 'coming' at the attendance check → the existing one reschedule round (§4.6). */
export const ATTENDANCE_MIN_COMING = 3;

/** At plan lock: a yes vote for the winning option counts as "I'm coming"; everyone else has not answered yet. */
export function attendanceAtPlanLock(memberUids: readonly Uid[], winningOptionVotes: Readonly<Record<Uid, 'yes' | 'no'>>): Record<Uid, AttendanceStatus> {
  return Object.fromEntries(memberUids.map((uid) => [uid, winningOptionVotes[uid] === 'yes' ? 'coming' : 'pending']));
}

/** Members to nudge at T−6 h: those who have not answered (a yes vote counts as an answer). */
export function membersToNudge(statuses: Readonly<Record<Uid, AttendanceStatus>>): Uid[] {
  return Object.keys(statuses)
    .filter((uid) => statuses[uid] === 'pending')
    .sort();
}

/** At the attendance check: no answer after both asks and the nudge → 'unconfirmed' ("<firstName> hasn't confirmed"). */
export function markUnconfirmed(statuses: Readonly<Record<Uid, AttendanceStatus>>): Record<Uid, AttendanceStatus> {
  return Object.fromEntries(Object.entries(statuses).map(([uid, s]) => [uid, s === 'pending' ? 'unconfirmed' : s]));
}

/** Only 'coming' counts: an unconfirmed member is not counted as coming, nor as a no-show. */
export function comingCount(statuses: Readonly<Record<Uid, AttendanceStatus>>): number {
  return Object.values(statuses).filter((s) => s === 'coming').length;
}

export function attendanceCheckPasses(statuses: Readonly<Record<Uid, AttendanceStatus>>, min: number = ATTENDANCE_MIN_COMING): boolean {
  return comingCount(statuses) >= min;
}

/**
 * "Who was there?" (D15): every other member starts ticked and the user unticks whoever was missing, so the
 * submitted `notThere` list resolves to a full attendance map. Unknown uids in `notThere` are an error.
 */
export function attendanceFromNotThere(otherMembers: readonly Uid[], notThere: readonly Uid[]): Record<Uid, 'came' | 'noShow'> {
  const missing = new Set(notThere);
  for (const uid of missing) if (!otherMembers.includes(uid)) throw new Error('attendanceFromNotThere: not a co-member');
  return Object.fromEntries(otherMembers.map((uid) => [uid, missing.has(uid) ? 'noShow' : 'came']));
}
