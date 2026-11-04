import type { CallableInput } from '@grouper/core';
import { useMutationState } from '@tanstack/react-query';

/**
 * Whether this device sent feedback for the pod in this app session. The feedback doc is server-only, so this is
 * what hides the "Give feedback" step afterwards; after a restart the step shows again until the 7-day window ends,
 * and the server refuses a second submission.
 */
export function useFeedbackSent(podId: string): boolean {
  const sent = useMutationState({
    filters: { mutationKey: ['callable', 'submitFeedback'], status: 'success' },
    select: (m) => (m.state.variables as CallableInput<'submitFeedback'> | undefined)?.podId,
  });
  return sent.includes(podId);
}
