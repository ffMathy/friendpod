/** The running preview: the selected scenario and the mutable fakes built from it (set once by install.ts). */
import type { Locale } from '@grouper/core';
import type { PreviewStore } from './store';
import type { PreviewUser, Scenario } from './types';

export interface PreviewIssue {
  readonly kind: 'error' | 'unhandledrejection' | 'blockedRequest' | 'callable' | 'scenario';
  readonly message: string;
}

export interface PreviewState {
  readonly scenario: Scenario;
  readonly locale: Locale;
  readonly platform: 'ios' | 'android';
  readonly store: PreviewStore;
  readonly secureStore: Map<string, string>;
  readonly auth: {
    user: PreviewUser | null;
    readonly listeners: Set<(user: PreviewUser | null) => void>;
  };
  readonly issues: PreviewIssue[];
}

let current: PreviewState | null = null;

export function setPreviewState(state: PreviewState): void {
  current = state;
}

export function preview(): PreviewState {
  if (!current) throw new Error('preview: runtime not installed (preview/runtime/boot.ts must load first)');
  return current;
}

export function reportIssue(issue: PreviewIssue): void {
  current?.issues.push(issue);
  console.warn(`[preview] ${issue.kind}: ${issue.message}`);
}
