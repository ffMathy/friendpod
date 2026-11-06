import type { InterestDoc, SensitiveInterestDoc } from '../schemas/documents';
import type { SensitivitySource } from './domain';
import type { ConsentRef, InterestId, NonSensitiveConceptId, SensitiveConceptId } from './ids';
import type { MatchTheme } from './matching';

declare const holdingKind: unique symbol;

/**
 * A holding read from `users/{uid}/interests` (§5.2 (5)). Only the repository layer that reads that
 * subcollection may create one (ordinaryHoldingFromDoc), so a self-flagged or tag-sensitive holding
 * can never be passed where ordinary data is expected.
 */
export interface OrdinaryHolding {
  readonly [holdingKind]: 'ordinary';
  readonly interestId: InterestId;
  readonly conceptId: NonSensitiveConceptId;
  readonly norm: string;
  readonly display: string;
  readonly starred: boolean;
}

/** A holding read from `users/{uid}/sensitiveInterests`: always carries its consent reference (S3). */
export interface SensitiveHolding {
  readonly [holdingKind]: 'sensitive';
  readonly interestId: InterestId;
  readonly conceptId: SensitiveConceptId;
  readonly norm: string;
  readonly display: string;
  readonly starred: boolean;
  readonly selfFlagged: boolean;
  readonly source: SensitivitySource;
  readonly consentRef: ConsentRef;
}

/** Repository constructor for `users/{uid}/interests/{interestId}`. */
export function ordinaryHoldingFromDoc(interestId: InterestId, doc: InterestDoc): OrdinaryHolding {
  return {
    interestId,
    conceptId: doc.conceptId as NonSensitiveConceptId,
    norm: doc.norm,
    display: doc.display,
    starred: doc.starred,
  } as OrdinaryHolding;
}

/** Repository constructor for `users/{uid}/sensitiveInterests/{interestId}`. */
export function sensitiveHoldingFromDoc(interestId: InterestId, doc: SensitiveInterestDoc): SensitiveHolding {
  if (!doc.consentEventId) throw new Error('sensitive holding without consentEventId');
  return {
    interestId,
    conceptId: doc.conceptId as SensitiveConceptId,
    norm: doc.norm,
    display: doc.display,
    starred: doc.starred,
    selfFlagged: doc.selfFlagged,
    source: doc.source,
    consentRef: doc.consentEventId as ConsentRef,
  } as SensitiveHolding;
}

export interface MatchProfileInterests {
  readonly themes: MatchTheme[];
  readonly themeIds: string[];
  /** Built only from ordinary holdings (S2). */
  readonly secondary: NonSensitiveConceptId[];
}

/** The only way to derive `matchProfiles.{themes, themeIds, secondary}` from holdings. */
export function matchProfileInterests(
  ordinary: readonly OrdinaryHolding[],
  sensitive: readonly SensitiveHolding[],
): MatchProfileInterests {
  const themes: MatchTheme[] = [];
  const at = new Map<string, number>();
  const add = (theme: MatchTheme): void => {
    const i = at.get(theme.c);
    if (i === undefined) {
      at.set(theme.c, themes.length);
      themes.push(theme);
    } else if (theme.starred) {
      // Different wordings ("løb", "running") can resolve to one concept: a star on any of them counts.
      themes[i] = { ...themes[i]!, starred: true };
    }
  };
  for (const h of ordinary) add({ c: h.conceptId, starred: h.starred, sens: false });
  for (const h of sensitive) add({ c: h.conceptId, starred: h.starred, sens: true, consentRef: h.consentRef });
  return {
    themes,
    themeIds: themes.map((t) => t.c),
    secondary: [...new Set(ordinary.map((h) => h.conceptId))],
  };
}
