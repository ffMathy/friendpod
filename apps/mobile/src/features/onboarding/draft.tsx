import type { Gh5 } from '@friendpod/core';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * Steps 3–6 of §3.1, held in memory until `completeOnboarding`. The date of birth never leaves this
 * object except in that one call (the server keeps only the birth year), and the postcode or
 * coordinates never enter it: only the geohash-5 cell does.
 */
export interface OnboardingDraft {
  readonly legalAccepted: boolean;
  readonly dob: string | null;
  readonly firstName: string | null;
  readonly gh5: Gh5 | null;
}

interface DraftContext {
  readonly draft: OnboardingDraft;
  update(patch: Partial<OnboardingDraft>): void;
  /** Drops every answer, e.g. after UNDERAGE: nothing typed by someone under 18 stays in memory. */
  reset(): void;
}

const EMPTY_DRAFT: OnboardingDraft = { legalAccepted: false, dob: null, firstName: null, gh5: null };

const Ctx = createContext<DraftContext | null>(null);

export function OnboardingDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<OnboardingDraft>(EMPTY_DRAFT);
  const value = useMemo<DraftContext>(() => ({ draft, update: (patch) => setDraft((d) => ({ ...d, ...patch })), reset: () => setDraft(EMPTY_DRAFT) }), [draft]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOnboardingDraft(): DraftContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useOnboardingDraft() outside OnboardingDraftProvider');
  return ctx;
}
