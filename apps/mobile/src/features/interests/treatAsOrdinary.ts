/**
 * Notice code for "a reviewer decided this text is not sensitive" (§5.2 (5) Review queue). Only an
 * explicit "Treat as ordinary" moves the holding to `interests`; no answer keeps it sensitive.
 */
export const REVIEWED_NOT_SENSITIVE_NOTICE = 'TAG_REVIEWED_NOT_SENSITIVE';

/**
 * DESIGN-DEVIATION: §10 lists no callable that moves a sensitive holding to `interests` and closes its
 * consent event as `superseded`; this stays a stub until the backend defines one.
 */
export async function treatAsOrdinary(_interestId: string): Promise<never> {
  throw new Error('not implemented (see DESIGN.md §5.2 (5) Review queue: no callable in §10 yet)');
}
