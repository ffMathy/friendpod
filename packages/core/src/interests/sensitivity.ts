import type { SensitivitySource } from '../types/domain';

/** Detector margin threshold for EmbeddingGemma 2 q4 / STS prompt / 768-d: 100% recall on the labelled set [CAL]. */
export const DETECTOR_MARGIN_THRESHOLD = -0.03;

export interface SensitivitySignals {
  /** Row 1: a human review decision on this exact norm, if any. */
  readonly reviewed: 'sensitive' | 'not' | null;
  /** Row 2: high-precision lexicon hit. */
  readonly lexiconHit: boolean;
  /** Row 3: the user asked to "Keep this private" (holding-level only). */
  readonly selfFlag: boolean;
  /** Row 4: max cos to Art. 9 prototypes − max cos to hobby anchors; null if not computed. */
  readonly detectorMargin: number | null;
  /** Possessive kinship pattern (thirdParty.ts). */
  readonly thirdParty: boolean;
}

export type TagSensitivity = 'sensitive' | 'suspected' | 'ordinary';

export interface SensitivityDecision {
  /** Shared, uid-free tag-level result (rows 1, 2 and 4). */
  readonly tag: TagSensitivity;
  readonly tagSource: Exclude<SensitivitySource, 'self'> | null;
  /** Holding-level result: the partition key everywhere (§5.2 (5)). */
  readonly holdingSensitive: boolean;
  /** `sensitiveInterests.source` when the holding is sensitive. */
  readonly holdingSource: SensitivitySource | null;
  /** Detector-only suspicion: queue the text (no uid) once someone consents. */
  readonly queueForReview: boolean;
  /** What the pipeline must do next. 'needsConsent' persists only with a valid consent payload. */
  readonly outcome: 'ordinary' | 'needsConsent' | 'refuseThirdParty';
  /** Ordinary third-party tag: stored as ordinary with the "only add interests about yourself" warning. */
  readonly thirdPartyWarning: boolean;
}

/**
 * Sensitivity per DESIGN.md §5.2 (5): reviewed > lexicon > self-flag > detector, first match wins.
 * Rows 1, 2 and 4 decide the tag; row 3 makes only this holding sensitive. A missing or non-finite
 * detector margin, when it is needed, fails closed as "suspected".
 */
export function decideSensitivity(signals: SensitivitySignals, threshold: number = DETECTOR_MARGIN_THRESHOLD): SensitivityDecision {
  let tag: TagSensitivity;
  let tagSource: SensitivityDecision['tagSource'];
  if (signals.reviewed !== null) {
    tag = signals.reviewed === 'sensitive' ? 'sensitive' : 'ordinary';
    tagSource = 'review';
  } else if (signals.lexiconHit) {
    tag = 'sensitive';
    tagSource = 'lexicon';
  } else {
    const m = signals.detectorMargin;
    const suspected = m === null || !Number.isFinite(m) || m >= threshold;
    tag = suspected ? 'suspected' : 'ordinary';
    tagSource = suspected ? 'model' : null;
  }

  const tagSensitiveForHolding = tag !== 'ordinary';
  let holdingSource: SensitivitySource | null = null;
  if (tag === 'sensitive') holdingSource = tagSource;
  else if (signals.selfFlag) holdingSource = 'self';
  else if (tag === 'suspected') holdingSource = 'model';
  const holdingSensitive = tagSensitiveForHolding || signals.selfFlag;

  const refuse = signals.thirdParty && tagSensitiveForHolding;
  return {
    tag,
    tagSource,
    holdingSensitive,
    holdingSource,
    queueForReview: tag === 'suspected' && !refuse,
    outcome: refuse ? 'refuseThirdParty' : holdingSensitive ? 'needsConsent' : 'ordinary',
    thirdPartyWarning: signals.thirdParty && !tagSensitiveForHolding,
  };
}
