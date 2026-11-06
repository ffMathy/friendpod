import type { SensitivitySource } from '../types/domain';
import { isDetectorFlag } from './detector';
import { DETECTOR_MARGIN_THRESHOLD } from './model';

export interface SensitivitySignals {
  /** Detector margin the phone computed on the tag's vector; null when unknown. */
  readonly detectorMargin: number | null;
  /** The user asked to "Keep this private" (holding-level only). */
  readonly selfFlagPrivate: boolean;
  /** The user chose "This isn't sensitive for me" (holding-level only). */
  readonly notSensitiveForMe: boolean;
  /** Possessive kinship pattern (thirdParty.ts). */
  readonly thirdParty: boolean;
  /** The user holds the blanket Art. 9 consent (D3, `users.legal.art9`). */
  readonly hasArt9Consent: boolean;
}

export type TagSensitivity = 'sensitive' | 'ordinary';
export type TagSensitivitySource = 'model';

export type SensitivityOutcome =
  /** Store as an ordinary holding. */
  | 'ordinary'
  /** Store as a sensitive holding under the blanket consent; protections apply silently. */
  | 'sensitive'
  /** Refused, nothing stored: the user has not given the blanket consent (it stays freely given, D3). */
  | 'refuseNoConsent'
  /** Refused, nothing stored: someone else's Art. 9 data (PRIVACY.md §4.3). */
  | 'refuseThirdParty';

export interface SensitivityDecision {
  /** Shared, uid-free tag-level result. */
  readonly tag: TagSensitivity;
  /** What decided the tag; null for an ordinary tag that nothing flagged. */
  readonly tagSource: TagSensitivitySource | null;
  /** Holding-level result: the partition key everywhere (§5.2 (5)). */
  readonly holdingSensitive: boolean;
  /** `sensitiveInterests.source` when the holding is sensitive. */
  readonly holdingSource: SensitivitySource | null;
  /** A sensitive tag held as ordinary because the user chose "This isn't sensitive for me". */
  readonly overridden: boolean;
  readonly outcome: SensitivityOutcome;
  /** Ordinary third-party tag: stored as ordinary with the "only add interests about yourself" warning. */
  readonly thirdPartyWarning: boolean;
}

/**
 * Sensitivity per DESIGN.md §5.2 (5) (D2, F38). The tag is decided by the on-device model alone: a detector flag
 * (a missing or non-finite margin fails closed) → sensitive, else ordinary. No word list adds or removes a flag.
 * The holding: "Keep this private" makes it sensitive; "This isn't sensitive for me" makes a sensitive tag ordinary
 * for this holding only, never for a third-party tag, whose subject cannot be waived for. The third-party pattern
 * is not a sensitivity source: it only reacts to the model's result. A sensitive holding needs the blanket consent.
 */
export function decideSensitivity(signals: SensitivitySignals, threshold: number = DETECTOR_MARGIN_THRESHOLD): SensitivityDecision {
  let tag: TagSensitivity;
  let tagSource: TagSensitivitySource | null;
  if (isDetectorFlag(signals.detectorMargin, threshold)) {
    tag = 'sensitive';
    tagSource = 'model';
  } else {
    tag = 'ordinary';
    tagSource = null;
  }

  if (signals.thirdParty && tag === 'sensitive') {
    return { tag, tagSource, holdingSensitive: false, holdingSource: null, overridden: false, outcome: 'refuseThirdParty', thirdPartyWarning: false };
  }

  let holdingSource: SensitivitySource | null = null;
  let overridden = false;
  if (signals.selfFlagPrivate) {
    holdingSource = tag === 'sensitive' ? 'model' : 'self';
  } else if (tag === 'sensitive') {
    if (signals.notSensitiveForMe) overridden = true;
    else holdingSource = 'model';
  }
  const holdingSensitive = holdingSource !== null;
  const outcome: SensitivityOutcome = !holdingSensitive ? 'ordinary' : signals.hasArt9Consent ? 'sensitive' : 'refuseNoConsent';
  return { tag, tagSource, holdingSensitive, holdingSource, overridden, outcome, thirdPartyWarning: signals.thirdParty };
}
