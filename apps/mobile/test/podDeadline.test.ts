import { planningDeadlineAsk } from '@/features/pods/deadline';

describe('planningDeadlineAsk (decision 2: one rule for the pod page and the plan page)', () => {
  it('asks for a first time while there is no option', () => {
    expect(planningDeadlineAsk([], 'me')).toBe('pickTime');
  });

  it('asks for a vote while any option has no vote from the viewer', () => {
    expect(planningDeadlineAsk([{ me: 'yes' }, { anna: 'yes' }], 'me')).toBe('vote');
  });

  it('is quiet once the viewer has voted on every option, yes or no', () => {
    expect(planningDeadlineAsk([{ me: 'no' }, { me: 'yes', anna: 'no' }], 'me')).toBeNull();
  });
});
