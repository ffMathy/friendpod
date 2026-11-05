/** Every callable of codebase "default" (DESIGN.md §10.1) with its final name and options. */
import type { CallableInput, CallableName, CallableOutput } from '@grouper/core';
import { callable, type CallContext } from '../lib/handler';
import { callableOptions } from '../lib/options';
import { appDeps, handlerDeps, modelsPrototypes, type AppDeps } from '../lib/runtime';
import { addInterestsWith } from './addInterests';
import { setArt9Consent as setArt9ConsentImpl, withdrawArt9Consent as withdrawArt9ConsentImpl } from './art9Consent';
import { completeOnboarding as completeOnboardingImpl } from './completeOnboarding';
import * as account from './account';
import * as interests from './interests';
import * as pods from './pods';
import * as safety from './safety';
import { sendMessage as sendMessageImpl } from './sendMessage';
import { setParticipation as setParticipationImpl } from './setParticipation';
import { updateProfile as updateProfileImpl } from './updateProfile';

type Impl<N extends CallableName> = (deps: AppDeps, call: CallContext, input: CallableInput<N>) => Promise<CallableOutput<N>>;

function define<N extends CallableName>(name: N, impl: Impl<N>) {
  return callable(name, callableOptions(name), (call, input) => impl(appDeps(), call, input), () => handlerDeps);
}

export const completeOnboarding = define('completeOnboarding', completeOnboardingImpl);
export const updateProfile = define('updateProfile', updateProfileImpl);
export const setParticipation = define('setParticipation', setParticipationImpl);
export const sendMessage = define('sendMessage', sendMessageImpl);
export const addInterests = define('addInterests', addInterestsWith({ prototypes: modelsPrototypes }));
export const setArt9Consent = define('setArt9Consent', setArt9ConsentImpl);
export const withdrawArt9Consent = define('withdrawArt9Consent', withdrawArt9ConsentImpl);
export const removeInterest = define('removeInterest', interests.removeInterest);
export const updateInterest = define('updateInterest', interests.updateInterest);
export const confirmSuggestion = define('confirmSuggestion', interests.confirmSuggestion);
// The pod lifecycle (§3.3–§3.8, §4.6): one podState transaction each, see callables/pods.ts.
export const respondToPod = define('respondToPod', pods.respondToPod);
export const setPhotoSharing = define('setPhotoSharing', pods.setPhotoSharing);
export const leavePod = define('leavePod', pods.leavePod);
export const proposeOption = define('proposeOption', pods.proposeOption);
export const voteOption = define('voteOption', pods.voteOption);
export const confirmAttendance = define('confirmAttendance', pods.confirmAttendance);
export const submitFeedback = define('submitFeedback', pods.submitFeedback);
// Block and report (§3.7): automated, expiring outcomes only (F17), see callables/safety.ts.
export const blockUser = define('blockUser', safety.blockUser);
export const unblockUser = define('unblockUser', safety.unblockUser);
export const report = define('report', safety.report);
// Account and data (§3.9, §3.10, §9), see callables/account.ts.
export const registerPushToken = define('registerPushToken', account.registerPushToken);
export const deletePhoto = define('deletePhoto', (d, c) => account.deletePhoto(d, c));
export const exportData = define('exportData', (d, c) => account.exportData(d, c));
export const deleteAccount = define('deleteAccount', (d, c) => account.deleteAccount(d, c));
