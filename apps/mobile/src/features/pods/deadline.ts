/**
 * Whether the planning deadline is still the viewer's to act on (blend decision 2), one rule for the pod page and the
 * plan page: while there is no option yet ("Pick a time by Tuesday 18:00") or an option they have not voted on ("Vote
 * by …", "Voting closes …"), the closing time is a needs-you pill; once they have voted on every option there is
 * nothing left for them to do, so it is a quiet clock status. In the extension round the banner already carries "add
 * another option", so a viewer who has voted on everything is not asked twice.
 */
export type DeadlineAsk = 'pickTime' | 'vote' | null;

export function planningDeadlineAsk(optionVotes: readonly Readonly<Record<string, 'yes' | 'no'>>[], uid: string): DeadlineAsk {
  if (optionVotes.length === 0) return 'pickTime';
  return optionVotes.some((votes) => votes[uid] === undefined) ? 'vote' : null;
}
