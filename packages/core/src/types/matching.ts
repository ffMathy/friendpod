import type { AccountStatus, Gender, Language, MatchingProfileId, RadiusKm, SensitiveHoldReason } from './domain';
import type { ConceptId, ConsentRef, Gh5, NonSensitiveConceptId, Uid, UidH, WeekId } from './ids';
import type { UnmatchedReason } from '../reasons';

/** One theme candidate of a user (`matchProfiles.themes`). A sensitive one always carries its consent reference (S3). */
export type MatchTheme =
  | { readonly c: ConceptId; readonly starred: boolean; readonly sens: false }
  | { readonly c: ConceptId; readonly starred: boolean; readonly sens: true; readonly consentRef: ConsentRef };

/** A frozen, projected `matchProfiles/{uid}` as read from the drop input snapshot (§6.5). */
export interface MatchUser {
  readonly uid: Uid;
  readonly uidH: UidH;
  readonly status: AccountStatus;
  readonly gh5: Gh5;
  readonly birthYear: number;
  readonly ageMin: number;
  readonly ageMax: number;
  readonly maxKm: RadiusKm;
  readonly sameGenderOnly: boolean;
  readonly gender: Gender | null;
  readonly languages: readonly Language[];
  /** 6-bit availability mask (see AVAILABILITY). */
  readonly availability: number;
  /** All holdings that may be a theme: ordinary and sensitive (§5.2 (5)). */
  readonly themes: readonly MatchTheme[];
  /** Ordinary holdings only (S2). */
  readonly secondary: readonly NonSensitiveConceptId[];
  /** uidH of blocked users and open-report counterparts, both directions (H4). */
  readonly blockedH: readonly UidH[];
  /** uidH → exclusive `untilWeek` of the H5 window (co-member or co-proposed). */
  readonly recentH: Readonly<Record<UidH, WeekId>>;
  /** r(u) (§4.4); 0.8 for new users. */
  readonly reliability: number;
  readonly waitingSinceWeek: WeekId;
  /** Accepted a pod that dissolved through no fault of theirs: +1 in f(u) (§4.6). */
  readonly priority: boolean;
  /** "Open to meet anyone" fallback theme (Q12). */
  readonly openToAnyone: boolean;
  readonly activePods: number;
  readonly activeSensitivePods: number;
  /** Weeks with a sensitive-themed proposal (last 12 weeks, S5). */
  readonly sensitiveProposals: readonly WeekId[];
  readonly sensitiveHold: { readonly reason: SensitiveHoldReason; readonly since: number } | null;
  /** Attended meetups confirmed by ≥ 2 co-members (S5). */
  readonly attendedVerified: number;
  /** Founder-invited alpha tester (S5 activity waiver in the alpha profile). */
  readonly founderInvited: boolean;
  /** Open reports against this user (S5). */
  readonly openReportCount: number;
  readonly weekClaim: WeekId | null;
  /** Account creation, epoch ms. */
  readonly createdAt: number;
}

/** The only concept fields the matcher reads (§6.4 Memory). */
export interface ConceptProjection {
  readonly id: ConceptId;
  /** 128-d float32 copy of the centroid. */
  readonly c128: Float32Array;
  readonly sensitive: boolean;
  readonly status: 'active' | 'merged';
  readonly mergedInto: ConceptId | null;
}

export interface MatchWeights {
  readonly B: number;
  readonly wT: number;
  readonly wF: number;
  readonly wR: number;
  readonly wP: number;
}

export interface MatchParams {
  readonly profile: MatchingProfileId;
  readonly minSize: number;
  readonly targetSize: number;
  readonly maxSize: number;
  /** 'expectedAttendance': a 6th seat when Σ r of the five < `sumRBelow`; 'always': 6 whenever 6 are compatible (§6.10). */
  readonly overbook: { readonly mode: 'expectedAttendance'; readonly sumRBelow: number } | { readonly mode: 'always' };
  readonly weights: MatchWeights;
  readonly sizePenalty: Readonly<Record<number, number>>;
  /** τ in sec(u,v); uncalibrated (§6.2). */
  readonly tau: number;
  readonly topThemes: number;
  readonly topK: number;
  /** Compatible candidates collected per seed and theme before pair scoring (bounds Phase 1 work). */
  readonly candidateScan: number;
  /** Evaluated local-search moves; never a wall-clock limit (§6.3). */
  readonly moveBudget: number;
  readonly maxPasses: number;
  readonly minDelta: number;
  readonly maxActivePods: number;
  readonly minInterests: number;
  readonly sensitive: {
    /** S1: eligible consenting holders within `densityKm` of the pod's centroid cell. Never relaxed. */
    readonly densityMin: number;
    readonly densityKm: number;
    readonly minAccountAgeDays: number;
    readonly minVerifiedAttended: number;
    readonly waiveActivityForFounderInvited: boolean;
    readonly maxProposalsPer12Weeks: number;
    readonly maxHoldings: number;
  };
  readonly openToAnyone: { readonly enabled: boolean; readonly minWeeksWaiting: number; readonly q: number };
}

export interface MatchInput {
  readonly weekId: WeekId;
  /** Drop compute time (Thu 16:00), epoch ms; the only clock the matcher sees. */
  readonly dropAt: number;
  readonly users: readonly MatchUser[];
  readonly concepts: readonly ConceptProjection[];
  readonly params: MatchParams;
  /** Tie-break seed; the weekId in production (§6.5). */
  readonly seed: string;
}

export type PodTheme =
  | { readonly kind: 'concept'; readonly conceptId: ConceptId; readonly sensitive: boolean }
  | { readonly kind: 'openToAnyone' };

/** Per-member inputs for "why this pod" (§6.7); wording is filled per viewer at release. */
export interface ReasonSeed {
  /** ≤ 3, ordinary themes only. */
  readonly alsoShare: readonly NonSensitiveConceptId[];
  /** Largest centroid distance to another member, rounded up to 5 km. */
  readonly nearKm: number;
  /** Ordinary themes only. */
  readonly ageSpan: { readonly min: number; readonly max: number } | null;
  readonly priorityWeeks: number | null;
}

export interface MatchedPod {
  /** Sorted uids; with the weekId they determine the podId. */
  readonly members: readonly Uid[];
  readonly theme: PodTheme;
  readonly value: number;
  readonly reasons: Readonly<Record<Uid, ReasonSeed>>;
}

export interface UnmatchedUser {
  readonly uid: Uid;
  readonly reason: UnmatchedReason;
}

export interface MatchStats {
  readonly users: number;
  readonly eligible: number;
  readonly matched: number;
  readonly pods: number;
  readonly podsBySize: Readonly<Record<number, number>>;
  readonly sensitivePods: number;
  readonly openToAnyonePods: number;
  readonly phase1Pods: number;
  readonly phase3Pods: number;
  readonly movesEvaluated: number;
  readonly inserts: number;
  readonly swaps: number;
  readonly objective: number;
  readonly droppedThemes: { readonly noConsent: number; readonly partition: number; readonly unknownConcept: number };
  readonly unmatchedByReason: Readonly<Partial<Record<UnmatchedReason, number>>>;
}

export interface MatchResult {
  readonly pods: readonly MatchedPod[];
  readonly unmatched: readonly UnmatchedUser[];
  /** Not considered at all (not active, or already claimed this week); release writes outcome 'excluded'. */
  readonly excluded: readonly Uid[];
  readonly stats: MatchStats;
}
