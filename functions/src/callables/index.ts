/**
 * Every callable of codebase "default" (DESIGN.md §10.1) with its final name and options. Stubs validate their
 * input like the real thing, then fail with `unimplemented` / `details: {code: 'NOT_IMPLEMENTED', design}`.
 */
import type { CallableInput, CallableName, CallableOutput } from '@grouper/core';
import { notImplemented } from '../lib/errors';
import { callable, type CallContext } from '../lib/handler';
import { callableOptions } from '../lib/options';
import { appDeps, handlerDeps, modelsPrototypes, type AppDeps } from '../lib/runtime';
import { addInterestsWith } from './addInterests';
import { setArt9Consent as setArt9ConsentImpl, withdrawArt9Consent as withdrawArt9ConsentImpl } from './art9Consent';
import { completeOnboarding as completeOnboardingImpl } from './completeOnboarding';
import * as pods from './pods';
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
export const addInterests = define('addInterests', addInterestsWith({ prototypes: modelsPrototypes }));
export const setArt9Consent = define('setArt9Consent', setArt9ConsentImpl);
// Implemented for a user without sensitive holdings; the holding steps are a typed stub (art9Consent.ts).
export const withdrawArt9Consent = define('withdrawArt9Consent', withdrawArt9ConsentImpl);

// One sensitive holding: the PRIVACY.md §3.5 effects for that holding only, in the step 4 order (find the pods through
// podState.memberList; remove the user from pods/{podId}.memberUids and roster, after which sendMessage refuses them;
// delete their meetup-chat messages; remove them from podState.members and memberList last, so that a retry after a
// failure still finds the pods). withdrawArt9Consent runs the same steps for every sensitive holding.
export const removeInterest = stub('removeInterest', '§10.1');
export const updateInterest = stub('updateInterest', '§10.1');
export const confirmSuggestion = stub('confirmSuggestion', '§5.2 (6)');
// The pod lifecycle (§3.3–§3.8, §4.6): one podState transaction each, see callables/pods.ts.
export const respondToPod = define('respondToPod', pods.respondToPod);
export const setPhotoSharing = define('setPhotoSharing', pods.setPhotoSharing);
export const leavePod = define('leavePod', pods.leavePod);
export const proposeOption = define('proposeOption', pods.proposeOption);
export const voteOption = define('voteOption', pods.voteOption);
export const confirmAttendance = define('confirmAttendance', pods.confirmAttendance);
export const submitFeedback = define('submitFeedback', pods.submitFeedback);
export const blockUser = stub('blockUser', '§3.7');
export const unblockUser = stub('unblockUser', '§3.7');
// A `message` target: read pods/{podId}/messages/{messageId} after checking the reporter is in the pod, copy its
// text into `report.message` ({text}) and its authorUid into `targetUid`, so the evidence outlives the message's TTL
// (§3.7, §8.2). The input schema already accepts the target. Outcomes are automatic and expire (D2): pauses and
// sensitive holds with `until`, never a permanent sanction.
export const report = stub('report', '§3.7');
export const registerPushToken = stub('registerPushToken', '§10.1');
export const deletePhoto = stub('deletePhoto', '§9');
// buildExport includes "about me" and the user's own meetup-chat messages that TTL has not yet deleted (PRIVACY.md §6).
export const exportData = stub('exportData', '§3.9');
export const deleteAccount = stub('deleteAccount', '§3.10');
