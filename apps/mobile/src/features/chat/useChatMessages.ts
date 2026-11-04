import type { PodMessageDoc } from '@grouper/core';
import { useEffect, useState } from 'react';
import { usePodMessages } from '@/data/docs';
import type { LiveResult, WithId } from '@/data/live';
import { rememberCachedMessages } from '@/features/account/useDeviceCacheHygiene';

/** setTimeout's limit; a longer wait just wakes up early and filters again. */
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

/**
 * A pod's meetup-chat messages that have not expired (§3.6). TTL deletes a message up to about a day after its
 * `expiresAt`, and the device cache can hold copies the server has already deleted, so a message is never shown
 * after `expiresAt` (the consent says "deleted 3 days after the meetup"). The clock is state, so the list
 * re-renders when the next message expires. Every read is recorded, so that the next cache-hygiene run after the
 * expiry clears the cached copies from the device too (PRIVACY.md §5 "Device caches").
 */
export function useChatMessages(uid: string, podId: string, enabled: boolean): LiveResult<WithId<PodMessageDoc>[]> {
  const messages = usePodMessages(podId, enabled);
  const [now, setNow] = useState(() => Date.now());
  const rows = messages.data;
  const expiries = rows?.map((r) => r.data.expiresAt.toMillis()) ?? [];
  const pending = expiries.filter((ms) => ms > now);
  const nextExpiry = pending.length > 0 ? Math.min(...pending) : null;
  const lastExpiry = expiries.length > 0 ? Math.max(...expiries) : null;

  useEffect(() => {
    if (nextExpiry === null) return undefined;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(Math.max(nextExpiry - Date.now(), 0), MAX_TIMEOUT_MS));
    return () => clearTimeout(timer);
  }, [nextExpiry]);

  // `rows` changes with every snapshot, including the first one after a cache clear re-subscribed the listener.
  useEffect(() => {
    if (lastExpiry !== null) void rememberCachedMessages(uid, podId, lastExpiry);
  }, [uid, podId, lastExpiry, rows]);

  return { ...messages, data: rows?.filter((r) => r.data.expiresAt.toMillis() > now) };
}
