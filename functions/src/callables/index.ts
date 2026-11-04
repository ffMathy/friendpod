/**
 * Every callable of codebase "default" (DESIGN.md §10.1) with its final name and options. Stubs validate their
 * input like the real thing, then fail with `unimplemented` / `details: {code: 'NOT_IMPLEMENTED', design}`.
 */
import type { CallableInput, CallableName, CallableOutput } from '@grouper/core';
import { notImplemented } from '../lib/errors';
import { callable, type CallContext } from '../lib/handler';
import { callableOptions } from '../lib/options';
import { appDeps, handlerDeps, type AppDeps } from '../lib/runtime';
import { completeOnboarding as completeOnboardingImpl } from './completeOnboarding';
import { sendMessage as sendMessageImpl } from './sendMessage';
import { setParticipation as setParticipationImpl } from './setParticipation';
import { updateProfile as updateProfileImpl } from './updateProfile';

type Impl<N extends CallableName> = (deps: AppDeps, call: CallContext, input: CallableInput<N>) => Promise<CallableOutput<N>>;

function define<N extends CallableName>(name: N, impl: Impl<N>) {
  return callable(name, callableOptions(name), (call, input) => impl(appDeps(), call, input), () => handlerDeps);
}

function stub<N extends CallableName>(name: N, design: string) {
  return callable(
    name,
    callableOptions(name),
    async () => {
      throw notImplemented(design);
    },
    () => handlerDeps,
  );
}

export const completeOnboarding = define('completeOnboarding', completeOnboardingImpl);
export const updateProfile = define('updateProfile', updateProfileImpl);
export const setParticipation = define('setParticipation', setParticipationImpl);
export const sendMessage = define('sendMessage', sendMessageImpl);

export const removeInterest = stub('removeInterest', '§10.1');
export const updateInterest = stub('updateInterest', '§10.1');
export const confirmSuggestion = stub('confirmSuggestion', '§5.2 (6)');
// Pods on the withdrawn theme, archived ones included, in this order (PRIVACY.md §3.5 step 4): find them through
// podState.memberList; remove the user from pods/{podId}.memberUids and roster, after which sendMessage refuses
// them; delete their meetup-chat messages (pods/{podId}/messages where authorUid == uid); remove them from
// podState.members and memberList last, so that a retry after a failure still finds the pods.
export const withdrawSensitive = stub('withdrawSensitive', '§10.1');
export const respondToPod = stub('respondToPod', '§4.6');
export const setPhotoSharing = stub('setPhotoSharing', '§6.1');
export const leavePod = stub('leavePod', '§3.8');
export const proposeOption = stub('proposeOption', '§3.5');
export const voteOption = stub('voteOption', '§3.5');
export const confirmAttendance = stub('confirmAttendance', '§3.6');
export const submitFeedback = stub('submitFeedback', '§3.6');
export const blockUser = stub('blockUser', '§3.7');
export const unblockUser = stub('unblockUser', '§3.7');
// A `message` target: read pods/{podId}/messages/{messageId} after checking the reporter is in the pod, copy its
// kind, text or quickReply into `report.message` and its authorUid into `targetUid`, so the evidence outlives
// the message's TTL (§3.7, §8.2). The input schema already accepts the target.
export const report = stub('report', '§3.7');
export const registerPushToken = stub('registerPushToken', '§10.1');
export const deletePhoto = stub('deletePhoto', '§9');
// buildExport includes the user's own meetup-chat messages that TTL has not yet deleted (PRIVACY.md §6).
export const exportData = stub('exportData', '§3.9');
export const deleteAccount = stub('deleteAccount', '§3.10');
