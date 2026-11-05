import { checkChatText, type ChatTextRejection, type ChatWarning } from '@grouper/core';
import { useCallback } from 'react';
import { useCallable } from '@/data/useCallable';
import { toAppError, type AppError } from '@/firebase/callables';

export type SendOutcome =
  | { readonly kind: 'sent'; readonly messageId: string }
  /** Nothing was stored (contact details before the meetup); resending with `ackContactWarning` sends it. */
  | { readonly kind: 'warned'; readonly warnings: readonly ChatWarning[] }
  /** Refused on the device, as the server would refuse it, so the text never left the phone. */
  | { readonly kind: 'refused'; readonly code: ChatTextRejection }
  | { readonly kind: 'failed'; readonly error: AppError };

/**
 * `sendMessage` (§3.6), text only (D14). CPR-like numbers and blocklisted text are checked here too, with the same core helper, so they
 * are never sent; the contact-details warning is left to the server, which knows whether the meetup has started.
 */
export function useSendMessage() {
  const { mutateAsync, isPending } = useCallable('sendMessage');

  const send = useCallback(
    async (podId: string, text: string, opts: { readonly ackContactWarning?: boolean } = {}): Promise<SendOutcome> => {
      const check = checkChatText(text.trim(), { beforeMeetup: false });
      if (!check.ok) return { kind: 'refused', code: check.code };
      try {
        const out = await mutateAsync({ podId, text, ...(opts.ackContactWarning ? { ackContactWarning: true } : {}) });
        return 'warnings' in out ? { kind: 'warned', warnings: out.warnings } : { kind: 'sent', messageId: out.messageId };
      } catch (e) {
        return { kind: 'failed', error: toAppError(e) };
      }
    },
    [mutateAsync],
  );

  return { send, pending: isPending };
}
