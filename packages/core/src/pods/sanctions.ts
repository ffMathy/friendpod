/**
 * Automated sanctions and holds (DESIGN.md §3.7, §4.4, A38; F17): every one is decided by a fixed rule, comes with a
 * statement of reasons, and expires on its own. Nobody reviews reports, report text or no-show accusations, and no
 * rule here can produce a permanent sanction. The functions apply these decisions inside the transaction of the event
 * (a report, feedback close, a late cancel); `hourlySweeper` lifts what has expired.
 */
import { DAY_MS } from '../time/schedule';
import { weeksBetween } from '../time/weekId';
import type { ReportCategory } from '../types/domain';
import type { WeekId } from '../types/ids';
import type { NoShowEvent } from './lifecycle';

/** The no-show windows of §4.4: weight within the last 8 weeks (the current week included). */
export const NO_SHOW_WINDOW_WEEKS = 8;
/** 2 no-show weight in 8 weeks → a 2-week pause plus a re-commit pledge (§4.4). */
export const NO_SHOW_PAUSE_WEIGHT = 2;
export const NO_SHOW_PAUSE_MS = 14 * DAY_MS;
/** 3 no-show weight in 8 weeks → an 8-week suspension, automated and expiring (§4.4, A38). */
export const NO_SHOW_SUSPENSION_WEIGHT = 3;
export const NO_SHOW_SUSPENSION_MS = 56 * DAY_MS;

/** Two independent reports within 30 days, or one safety report → paused from drops for 28 days (§3.7). */
export const REPORT_WINDOW_MS = 30 * DAY_MS;
export const REPORTS_FOR_PAUSE = 2;
export const REPORT_PAUSE_MS = 28 * DAY_MS;
/** Suspected under 18 → paused for 28 days; another such report from a different pod restarts it (§3.7). */
export const UNDERAGE_PAUSE_MS = 28 * DAY_MS;
/** "Not a genuine member" in a sensitive-themed pod → the 28-day sensitive-theme hold (S7). */
export const SENSITIVE_HOLD_MS = 28 * DAY_MS;
/** Reports expire 12 months after creation (TTL); nobody resolves them by hand (§8.2). */
export const REPORT_RETENTION_MS = 365 * DAY_MS;

/**
 * Notice codes (`users/{uid}/notices.code`). Statements of reasons (DSA Arts. 16–17) name the rule, never the
 * reporter, the report text or an option's or message's text; params are ids, dates and counts only.
 */
export const NOTICE_CODES = {
  /** Two independent reports within 30 days: paused from drops (statementOfReasons). */
  PAUSE_REPORTS: 'PAUSE_REPORTS',
  /** One safety report: paused from drops (statementOfReasons). */
  PAUSE_SAFETY_REPORT: 'PAUSE_SAFETY_REPORT',
  /** Suspected under 18: paused from drops (statementOfReasons). */
  PAUSE_UNDERAGE_REPORT: 'PAUSE_UNDERAGE_REPORT',
  /** 2 no-show weight within 8 weeks: a 2-week pause and the re-commit pledge (statementOfReasons). */
  PAUSE_NO_SHOW: 'PAUSE_NO_SHOW',
  /** 3 no-show weight within 8 weeks: an 8-week suspension (statementOfReasons). */
  SUSPENSION_NO_SHOW: 'SUSPENSION_NO_SHOW',
  /** "Not a genuine member": no sensitive-themed proposals for 28 days (statementOfReasons). */
  SENSITIVE_HOLD_NOT_GENUINE: 'SENSITIVE_HOLD_NOT_GENUINE',
  /** An automated pause, suspension or hold ran out (system). */
  SANCTION_ENDED: 'SANCTION_ENDED',
  /** The reporter's acknowledgement (system); the safety category adds "call 112 in an emergency" in the app. */
  REPORT_RECEIVED: 'REPORT_RECEIVED',
  /** Someone left the pod, was removed or withdrew (system, generic: "A member left"). */
  POD_MEMBER_LEFT: 'POD_MEMBER_LEFT',
  /** The data export is ready to download for 24 h (system). */
  EXPORT_READY: 'EXPORT_READY',
  /** 12 months without activity: the account is deleted 30 days later unless the user opens the app (system). */
  INACTIVITY_WARNING: 'INACTIVITY_WARNING',
} as const;
export type NoticeCode = (typeof NOTICE_CODES)[keyof typeof NOTICE_CODES];

export type SanctionType = 'pause' | 'suspension';
/** The pause reasons on `users.participation.pauseReason` that only an expiry lifts (no human lifts them, D2). */
export type SanctionReason = 'noShow' | 'reports' | 'underageReport';

export interface SanctionDecision {
  readonly type: SanctionType;
  readonly reason: SanctionReason;
  /** Epoch ms; every sanction ends (F17). */
  readonly until: number;
  readonly noticeCode: NoticeCode;
}

/** Sum of no-show weight (1 per no-show, 0.5 per late cancel) within the 8-week window ending in `currentWeek`. */
export function noShowWeight(events: readonly NoShowEvent[], currentWeek: WeekId): number {
  return events.filter((e) => {
    const age = weeksBetween(e.weekId, currentWeek);
    return age >= 0 && age < NO_SHOW_WINDOW_WEEKS;
  }).reduce((s, e) => s + e.w, 0);
}

/** The no-show rule of §4.4 after a new event: suspension at 3, pause at 2, otherwise nothing. */
export function noShowSanction(events: readonly NoShowEvent[], currentWeek: WeekId, now: number): SanctionDecision | null {
  const w = noShowWeight(events, currentWeek);
  if (w >= NO_SHOW_SUSPENSION_WEIGHT) return { type: 'suspension', reason: 'noShow', until: now + NO_SHOW_SUSPENSION_MS, noticeCode: NOTICE_CODES.SUSPENSION_NO_SHOW };
  if (w >= NO_SHOW_PAUSE_WEIGHT) return { type: 'pause', reason: 'noShow', until: now + NO_SHOW_PAUSE_MS, noticeCode: NOTICE_CODES.PAUSE_NO_SHOW };
  return null;
}

/** A report already on file against the same target, as the report rule sees it. */
export interface PriorReport {
  readonly reporterKey: string;
  readonly podId: string;
  readonly category: ReportCategory;
  /** Epoch ms. */
  readonly createdAt: number;
}

export interface ReportOutcome {
  readonly sanction: SanctionDecision | null;
  /** The sensitive-theme hold (S7), from a "not a genuine member" report. */
  readonly sensitiveHoldUntil: number | null;
  /** The automated outcome code stored on the report (`reports.decision`). */
  readonly decision: 'PAUSED' | 'PAUSE_RESTARTED' | 'HOLD' | 'RECORDED';
}

/**
 * The automated report rules of §3.7 for one new report against `target`. `prior` are the target's other reports
 * (any age; the rule applies its own windows), `activeUnderage` the start of a running under-18 pause, if any.
 * Independence: reports by the same reporter count once, so one person cannot pause someone alone.
 */
export function reportOutcome(
  report: { readonly reporterKey: string; readonly podId: string; readonly category: ReportCategory; readonly sensitivePod: boolean },
  prior: readonly PriorReport[],
  now: number,
  activeUnderage: { readonly since: number } | null = null,
): ReportOutcome {
  if (report.category === 'underage') {
    if (activeUnderage) {
      // Another such report restarts the pause only when it comes from a different pod than the reports so far.
      const pods = new Set(prior.filter((p) => p.category === 'underage' && p.createdAt >= activeUnderage.since).map((p) => p.podId));
      if (pods.has(report.podId)) return { sanction: null, sensitiveHoldUntil: null, decision: 'RECORDED' };
      return { sanction: underagePause(now), sensitiveHoldUntil: null, decision: 'PAUSE_RESTARTED' };
    }
    return { sanction: underagePause(now), sensitiveHoldUntil: null, decision: 'PAUSED' };
  }
  if (report.category === 'notGenuine') {
    return report.sensitivePod
      ? { sanction: null, sensitiveHoldUntil: now + SENSITIVE_HOLD_MS, decision: 'HOLD' }
      : { sanction: null, sensitiveHoldUntil: null, decision: 'RECORDED' };
  }
  if (report.category === 'safety') {
    return { sanction: { type: 'pause', reason: 'reports', until: now + REPORT_PAUSE_MS, noticeCode: NOTICE_CODES.PAUSE_SAFETY_REPORT }, sensitiveHoldUntil: null, decision: 'PAUSED' };
  }
  const reporters = new Set(prior.filter((p) => p.createdAt > now - REPORT_WINDOW_MS && p.category !== 'notGenuine').map((p) => p.reporterKey));
  reporters.add(report.reporterKey);
  if (reporters.size >= REPORTS_FOR_PAUSE) {
    return { sanction: { type: 'pause', reason: 'reports', until: now + REPORT_PAUSE_MS, noticeCode: NOTICE_CODES.PAUSE_REPORTS }, sensitiveHoldUntil: null, decision: 'PAUSED' };
  }
  return { sanction: null, sensitiveHoldUntil: null, decision: 'RECORDED' };
}

function underagePause(now: number): SanctionDecision {
  return { type: 'pause', reason: 'underageReport', until: now + UNDERAGE_PAUSE_MS, noticeCode: NOTICE_CODES.PAUSE_UNDERAGE_REPORT };
}

export interface ExistingSanction {
  readonly type: SanctionType;
  readonly reason: string;
  readonly until: number;
}

/**
 * Combines a running sanction with a new decision: a suspension outranks a pause, and the later end date wins, except
 * that a restarted under-18 pause sets its own end (it "restarts", §3.7). Never longer than the longer of the two.
 */
export function mergeSanction(existing: ExistingSanction | null, next: SanctionDecision, now: number): SanctionDecision {
  if (!existing || existing.until <= now) return next;
  const type: SanctionType = existing.type === 'suspension' || next.type === 'suspension' ? 'suspension' : 'pause';
  const stronger = next.type === 'suspension' || existing.type !== 'suspension' ? next : null;
  const until = Math.max(existing.until, next.until);
  if (stronger) return { ...stronger, type, until };
  return { type, reason: existing.reason as SanctionReason, until, noticeCode: next.noticeCode };
}
