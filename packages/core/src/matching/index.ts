export { matchComponent } from './matchComponent';
export { deriveContext, OPEN_THEME, seedPriorityCompare, type DerivedUser, type MatchContext } from './context';
export {
  assertAllConstraints,
  compat,
  compatFailure,
  holdsTheme,
  MatchConstraintError,
  podViolation,
  sensitiveDensityOk,
  type HardConstraint,
  type PodConstraint,
} from './constraints';
export { pairScore, podValue, reliability, secScore, selfScore, specificity, themeStrength, waitingPriority } from './score';
export { COMPONENT_LINK_KM, matchingComponents, type MatchingComponent } from './components';
export { grow, collectCandidates, topCandidates, viablePod } from './grow';
export { insertLeftover, localSearch, swapInLeftover, type Move, type SearchState } from './localSearch';
export {
  ALPHA_PROFILE,
  defaultAgeRange,
  getMatchingProfile,
  LAUNCH_PROFILE,
  MATCHING_PROFILES,
  recentUntilWeek,
  type MatchingProfile,
  type ProfileDefaults,
} from './profiles';
export { unmatchedReason } from './unmatched';
export {
  meetAgainOutcome,
  mergeRecentUntil,
  NEVER_WEEK_ID,
  recentUntilAfterMeetAgain,
  setRecentAfterMeetAgain,
  type MeetAgainAnswer,
  type PairOutcome,
} from './pairHistory';
export { decodeC128, decodeMatchSnapshot, encodeC128, encodeMatchSnapshot, matchResultFile, type DecodedSnapshot } from './snapshot';
