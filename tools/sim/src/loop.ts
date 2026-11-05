/**
 * The 12-week loop (DESIGN.md §6.9): drop → accept/decline → backfill → confirmation → planning →
 * meetup → feedback, with pair history, reliability and waiting priority carried between weeks.
 * Synthetic: every behaviour is an assumption (behaviour.ts), not a measurement.
 */
import {
  addWeeks,
  compat,
  type ConsentRef,
  deriveContext,
  dropSchedule,
  holdsTheme,
  type MatchContext,
  type MatchedPod,
  type MatchingProfile,
  matchComponent,
  type MatchInput,
  matchingComponents,
  type MatchTheme,
  type MatchUser,
  type NonSensitiveConceptId,
  OPEN_THEME,
  pairScore,
  recentUntilWeek,
  reliability,
  sensitiveDensityOk,
  type UnmatchedReason,
  type WeekId,
} from '@grouper/core';
import { acceptProbability, BEHAVIOUR, meetAgainProbability } from './behaviour';
import { generateCity, type SimUser, ZIPF_Q, ZIPF_S } from './city';
import { censoredPercentile, dominantCause, ratio, round, type StarvationCause } from './metrics';
import { Rng } from './rng';

export interface SimOptions {
  readonly n: number;
  readonly weeks: number;
  readonly profile: MatchingProfile;
  readonly seed: number;
  readonly concepts?: number;
  readonly startWeek?: WeekId;
  /** Seed-theme cohorts (alpha recruiting, §6.10); 0 = open recruiting. */
  readonly cohorts?: number;
}

interface UserState {
  attended: number;
  noShows: number;
  attendedVerified: number;
  waitingSinceWeek: WeekId;
  priority: boolean;
  slots: { until: WeekId; sensitive: boolean }[];
  recentH: Map<string, WeekId>;
  declinesInRow: number;
  pausedUntil: WeekId | null;
  sensitiveProposals: WeekId[];
  firstProposed: number | null;
  firstConfirmed: number | null;
  reasons: UnmatchedReason[];
}

interface Counters {
  optedIn: number;
  proposedUsers: number;
  proposedPods: number;
  confirmedPods: number;
  invites: number;
  accepts: number;
  backfillInvites: number;
  backfillRescues: number;
  happened: number;
  attendanceSlots: number;
  attendees: number;
  meetAgainPairs: number;
  meetAgainYes: number;
  kept: number;
  sensitivePods: number;
  openToAnyonePods: number;
  podSize: Record<number, number>;
  confirmedBySize: Record<number, number>;
  matchMs: number;
  matchMsMax: number;
  /** Proposed seats (release, not backfill) that went to users without a confirmed pod yet (§6.2). */
  firstTimerSeats: number;
  /** Seats offered while at least one first-timer of that component was left unmatched. */
  firstTimersLeftOut: number;
}

function toMatchUser(u: SimUser, s: UserState, weekId: WeekId): MatchUser {
  for (const [h, until] of s.recentH) if (until <= weekId) s.recentH.delete(h);
  const active = s.slots.filter((x) => x.until > weekId);
  const themes: MatchTheme[] = u.holdings.map((h) =>
    h.sens ? { c: h.c, starred: h.starred, sens: true, consentRef: `ce_${u.uid}_${h.c}` as ConsentRef } : { c: h.c, starred: h.starred, sens: false },
  );
  return {
    uid: u.uid,
    uidH: u.uidH,
    status: 'active',
    gh5: u.gh5,
    birthYear: u.birthYear,
    ageMin: u.ageMin,
    ageMax: u.ageMax,
    maxKm: u.maxKm,
    sameGenderOnly: u.sameGenderOnly,
    gender: u.gender,
    languages: u.languages,
    availability: u.availability,
    themes,
    secondary: u.holdings.filter((h) => !h.sens).map((h) => h.c as NonSensitiveConceptId),
    blockedH: u.blockedH,
    recentH: Object.fromEntries(s.recentH),
    reliability: reliability({ attended: s.attended, noShows: s.noShows, lateCancels: 0 }),
    waitingSinceWeek: s.waitingSinceWeek,
    priority: s.priority,
    // Never had a confirmed pod (`milestones.firstConfirmedAt` absent in production, §6.2).
    firstTimer: s.firstConfirmed === null,
    openToAnyone: u.openToAnyone,
    activePods: active.length,
    activeSensitivePods: active.filter((x) => x.sensitive).length,
    sensitiveProposals: s.sensitiveProposals.filter((w) => w > addWeeks(weekId, -12)),
    sensitiveHold: null,
    attendedVerified: s.attendedVerified,
    founderInvited: u.founderInvited,
    openReportCount: 0,
    weekClaim: null,
    createdAt: u.createdAt,
  };
}

function remember(states: Map<string, UserState>, ctx: MatchContext, members: readonly number[], until: WeekId): void {
  for (const a of members) {
    const s = states.get(ctx.users[a]!.uid)!;
    for (const b of members) {
      if (a === b) continue;
      const h = ctx.users[b]!.uidH;
      const prev = s.recentH.get(h);
      if (!prev || prev < until) s.recentH.set(h, until);
    }
  }
}

export function simulate(opts: SimOptions) {
  const started = performance.now();
  const startWeek = opts.startWeek ?? ('2027-W02' as WeekId);
  const city = generateCity({
    n: opts.n,
    seed: opts.seed,
    profile: opts.profile,
    concepts: opts.concepts ?? 2000,
    cohorts: opts.cohorts ?? 0,
    startAt: dropSchedule(startWeek).computeAt,
  });
  const rng = new Rng(opts.seed).fork('behaviour');
  const states = new Map<string, UserState>(
    city.users.map((u) => [
      u.uid,
      {
        attended: 0,
        noShows: 0,
        attendedVerified: 0,
        waitingSinceWeek: startWeek,
        priority: false,
        slots: [],
        recentH: new Map(),
        declinesInRow: 0,
        pausedUntil: null,
        sensitiveProposals: [],
        firstProposed: null,
        firstConfirmed: null,
        reasons: [],
      },
    ]),
  );
  const c: Counters = {
    optedIn: 0, proposedUsers: 0, proposedPods: 0, confirmedPods: 0, invites: 0, accepts: 0, backfillInvites: 0, backfillRescues: 0,
    happened: 0, attendanceSlots: 0, attendees: 0, meetAgainPairs: 0, meetAgainYes: 0, kept: 0, sensitivePods: 0, openToAnyonePods: 0,
    podSize: {}, confirmedBySize: {}, matchMs: 0, matchMsMax: 0, firstTimerSeats: 0, firstTimersLeftOut: 0,
  };
  const perWeek: { week: WeekId; optedIn: number; proposed: number; pods: number; confirmed: number; matchMs: number }[] = [];

  for (let w = 0; w < opts.weeks; w++) {
    const weekId = addWeeks(startWeek, w);
    const dropAt = dropSchedule(weekId).computeAt;
    const participants = city.users.filter((u) => {
      const s = states.get(u.uid)!;
      if (s.pausedUntil && s.pausedUntil <= weekId) s.pausedUntil = null;
      return s.pausedUntil === null;
    });
    const week = { week: weekId, optedIn: participants.length, proposed: 0, pods: 0, confirmed: 0, matchMs: 0 };
    c.optedIn += participants.length;

    for (const comp of matchingComponents(participants.map((u) => u.gh5))) {
      const cells = new Set(comp.cells);
      const input: MatchInput = {
        weekId,
        dropAt,
        users: participants.filter((u) => cells.has(u.gh5)).map((u) => toMatchUser(u, states.get(u.uid)!, weekId)),
        concepts: city.concepts,
        params: opts.profile.params,
        seed: weekId,
      };
      const t0 = performance.now();
      const result = matchComponent(input);
      const ms = performance.now() - t0;
      week.matchMs += ms;

      const ctx = deriveContext(input);
      const idx = new Map(ctx.users.map((u) => [u.uid, u.idx]));
      const conceptIdx = new Map(ctx.conceptIds.map((id, i) => [id, i]));
      const claimed = new Set<string>(result.pods.flatMap((p) => p.members));
      for (const u of result.unmatched) states.get(u.uid)!.reasons.push(u.reason);
      for (const pod of result.pods) for (const uid of pod.members) if (states.get(uid)!.firstConfirmed === null) c.firstTimerSeats++;
      c.firstTimersLeftOut += result.unmatched.filter((u) => states.get(u.uid)!.firstConfirmed === null).length;

      for (const pod of result.pods) {
        const theme = pod.theme.kind === 'openToAnyone' ? OPEN_THEME : conceptIdx.get(pod.theme.conceptId)!;
        const sensitive = pod.theme.kind === 'concept' && pod.theme.sensitive;
        runPod(pod, theme, sensitive);
      }

      function runPod(pod: MatchedPod, theme: number, sensitive: boolean): void {
        const invitees = pod.members.map((uid) => idx.get(uid)!);
        week.proposed += invitees.length;
        week.pods++;
        c.proposedUsers += invitees.length;
        c.proposedPods++;
        c.podSize[invitees.length] = (c.podSize[invitees.length] ?? 0) + 1;
        if (sensitive) c.sensitivePods++;
        if (theme === OPEN_THEME) c.openToAnyonePods++;
        remember(states, ctx, invitees, recentUntilWeek(weekId, 'coProposed', opts.profile));

        const accepted: number[] = [];
        const respond = (u: number, all: readonly number[]): void => {
          const s = states.get(ctx.users[u]!.uid)!;
          s.firstProposed ??= w;
          if (sensitive) s.sensitiveProposals.push(weekId);
          c.invites++;
          if (rng.chance(acceptProbability(ctx, all, theme, u))) {
            accepted.push(u);
            c.accepts++;
            s.declinesInRow = 0;
          } else if (++s.declinesInRow >= BEHAVIOUR.pauseAfterDeclines) {
            s.declinesInRow = 0;
            s.pausedUntil = addWeeks(weekId, BEHAVIOUR.pauseWeeks + 1);
          }
        };
        for (const u of invitees) respond(u, invitees);
        const need = opts.profile.defaults.confirmationMin;

        // Backfill (§4.2): with 2–3 accepted, invite compatible holders from this week's unmatched pool.
        if (accepted.length >= 2 && accepted.length < need) {
          const pool = ctx.users
            .filter((u) => u.ineligible === null && !claimed.has(u.uid) && holdsTheme(ctx, u.idx, theme))
            .filter((u) => accepted.every((m) => compat(ctx, u.idx, m)) && (accepted.reduce((a, m) => a & ctx.users[m]!.avail, u.avail) !== 0))
            .filter((u) => !sensitive || sensitiveDensityOk(ctx, theme, [...accepted, u.idx]))
            .map((u) => ({ u: u.idx, score: accepted.reduce((s, m) => s + pairScore(ctx, u.idx, m), 0) }))
            .sort((a, b) => b.score - a.score || a.u - b.u);
          const before = accepted.length;
          for (const { u } of pool.slice(0, 3)) {
            if (accepted.length >= need) break;
            claimed.add(ctx.users[u]!.uid);
            c.backfillInvites++;
            c.proposedUsers++;
            respond(u, [...accepted, u]);
          }
          if (before < need && accepted.length >= need) c.backfillRescues++;
        }

        if (accepted.length < need) {
          // Dissolved through no fault of those who accepted: priority next week (§4.6).
          for (const u of accepted) states.get(ctx.users[u]!.uid)!.priority = true;
          return;
        }
        c.confirmedPods++;
        c.confirmedBySize[invitees.length] = (c.confirmedBySize[invitees.length] ?? 0) + 1;
        week.confirmed++;
        remember(states, ctx, accepted, recentUntilWeek(weekId, 'coMember', opts.profile));
        for (const u of accepted) {
          const s = states.get(ctx.users[u]!.uid)!;
          s.firstConfirmed ??= w;
          s.priority = false;
          s.waitingSinceWeek = addWeeks(weekId, 1);
          s.slots.push({ until: addWeeks(weekId, BEHAVIOUR.activeWeeks), sensitive });
        }
        if (!rng.chance(BEHAVIOUR.planningSuccess)) {
          for (const u of accepted) states.get(ctx.users[u]!.uid)!.priority = true;
          return;
        }
        // Show-up = r(u) (§6.9).
        const came = accepted.filter((u) => rng.chance(ctx.users[u]!.r));
        c.attendanceSlots += accepted.length;
        c.attendees += came.length;
        for (const u of accepted) {
          const s = states.get(ctx.users[u]!.uid)!;
          if (came.includes(u)) s.attended++;
          else s.noShows++;
        }
        if (came.length < 3) return;
        c.happened++;
        for (const u of came) states.get(ctx.users[u]!.uid)!.attendedVerified++;
        let keep = 0;
        for (const u of came) {
          let sum = 0;
          for (const v of came) {
            if (u === v) continue;
            const p = meetAgainProbability(ctx, u, v, rng);
            sum += p;
            c.meetAgainPairs++;
            if (rng.chance(p)) c.meetAgainYes++;
          }
          if (rng.chance(sum / (came.length - 1))) keep++;
        }
        if (keep >= 3) {
          c.kept++;
          for (const u of came) states.get(ctx.users[u]!.uid)!.slots.push({ until: addWeeks(weekId, 2 * BEHAVIOUR.activeWeeks), sensitive });
        }
      }
    }
    c.matchMs += week.matchMs;
    c.matchMsMax = Math.max(c.matchMsMax, week.matchMs);
    perWeek.push({ ...week, matchMs: Number(week.matchMs.toFixed(1)) });
  }

  const all = [...states.values()];
  const firstPod = all.map((s) => (s.firstConfirmed === null ? Infinity : s.firstConfirmed + 1));
  const firstProposal = all.map((s) => (s.firstProposed === null ? Infinity : s.firstProposed + 1));
  const never = all.filter((s) => s.firstConfirmed === null);
  const byCause: Partial<Record<StarvationCause, number>> = {};
  for (const s of never) {
    const cause = dominantCause(s.reasons, s.firstProposed !== null);
    byCause[cause] = (byCause[cause] ?? 0) + 1;
  }
  return {
    synthetic: true,
    config: {
      n: opts.n,
      weeks: opts.weeks,
      profile: opts.profile.id,
      seed: opts.seed,
      concepts: opts.concepts ?? 2000,
      cohorts: opts.cohorts ?? 0,
      zipf: { s: ZIPF_S, q: ZIPF_Q },
      behaviour: BEHAVIOUR,
    },
    metrics: {
      matchRate: round(ratio(c.proposedUsers - c.backfillInvites, c.optedIn)),
      inviteAcceptance: round(ratio(c.accepts, c.invites)),
      confirmationRate: round(ratio(c.confirmedPods, c.proposedPods)),
      proposedPods: c.proposedPods,
      confirmedPods: c.confirmedPods,
      backfillInvites: c.backfillInvites,
      backfillRescues: c.backfillRescues,
      podSizes: c.podSize,
      confirmationBySize: Object.fromEntries(Object.entries(c.podSize).map(([size, n]) => [size, round((c.confirmedBySize[Number(size)] ?? 0) / n)])),
      sensitivePods: c.sensitivePods,
      openToAnyonePods: c.openToAnyonePods,
      weeksToFirstPod: { p50: censoredPercentile(firstPod, 0.5), p90: censoredPercentile(firstPod, 0.9) },
      weeksToFirstProposal: { p50: censoredPercentile(firstProposal, 0.5), p90: censoredPercentile(firstProposal, 0.9) },
      neverMatchedShare: round(never.length / Math.max(1, all.length)),
      neverMatchedByCause: Object.fromEntries(Object.entries(byCause).map(([k, v]) => [k, round(v / Math.max(1, all.length))])),
      meetupHappenedRate: round(ratio(c.happened, c.confirmedPods)),
      attendance: round(ratio(c.attendees, c.attendanceSlots)),
      meetAgainRate: round(ratio(c.meetAgainYes, c.meetAgainPairs)),
      continuationRate: round(ratio(c.kept, c.happened)),
      firstTimers: {
        /** Share of drop seats (before backfill) that went to users without a confirmed pod yet (§6.2). */
        seatShare: round(ratio(c.firstTimerSeats, c.proposedUsers - c.backfillInvites)),
        /** First-timer user-weeks left unmatched. */
        leftOut: c.firstTimersLeftOut,
      },
      runtimeMs: { matchTotal: round(c.matchMs, 1), matchMaxWeek: round(c.matchMsMax, 1), wall: round(performance.now() - started, 1) },
      perWeek,
    },
  };
}

export type SimResult = ReturnType<typeof simulate>;
