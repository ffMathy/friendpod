/** Typed live reads of the client-readable documents (DESIGN.md §8.1); rules allow nothing else. */
import {
  areaDocSchema,
  interestDocSchema,
  noticeDocSchema,
  optionDocSchema,
  podCardDocSchema,
  podDocSchema,
  podMessageDocSchema,
  sensitiveInterestDocSchema,
  userBlockDocSchema,
  userDocSchema,
} from '@grouper/core';
import { orderBy } from '@react-native-firebase/firestore';
import { useLiveCollection, useLiveDoc } from './live';

export const useUserDoc = (uid: string | null) => useLiveDoc(uid ? `users/${uid}` : null, userDocSchema);

export const useInterests = (uid: string) =>
  useLiveCollection(`users/${uid}/interests`, interestDocSchema, [orderBy('createdAt', 'asc')]);

export const useSensitiveInterests = (uid: string) =>
  useLiveCollection(`users/${uid}/sensitiveInterests`, sensitiveInterestDocSchema, [orderBy('consentedAt', 'asc')]);

export const usePodCards = (uid: string) =>
  useLiveCollection(`users/${uid}/pods`, podCardDocSchema, [orderBy('acceptBy', 'desc')]);

export const usePodCard = (uid: string, podId: string) => useLiveDoc(`users/${uid}/pods/${podId}`, podCardDocSchema);

/** `pods/{podId}` exists only after confirmation and is readable only by current members (§9). */
export const usePod = (podId: string, isMember: boolean) => useLiveDoc(isMember ? `pods/${podId}` : null, podDocSchema);

export const usePodOptions = (podId: string, isMember: boolean) =>
  useLiveCollection(isMember ? `pods/${podId}/options` : null, optionDocSchema, [orderBy('startsAt', 'asc')]);

/**
 * Meetup-chat messages (§3.6). Members can read them until TTL deletes them, also outside the window, which only
 * `sendMessage` enforces. Screens use `useChatMessages`, which hides expired ones and has the device cache cleared
 * after they expire; like the other pod paths, they also leave the cache with the pod (forgetPods) and at sign-out.
 */
export const usePodMessages = (podId: string, isMember: boolean) =>
  useLiveCollection(isMember ? `pods/${podId}/messages` : null, podMessageDocSchema, [orderBy('createdAt', 'asc')]);

export const useBlocks = (uid: string) => useLiveCollection(`users/${uid}/blocks`, userBlockDocSchema);

export const useNotices = (uid: string) =>
  useLiveCollection(`users/${uid}/notices`, noticeDocSchema, [orderBy('createdAt', 'desc')]);

export const useAreaDoc = (areaId: string | null) => useLiveDoc(areaId ? `areas/${areaId}` : null, areaDocSchema);
