import { AvatarFills, Colors } from '@/components/theme';
import { memberFills, viewerLast } from '@/features/pods/memberFill';

const SIX = ['a', 'b', 'me', 'c', 'd', 'e'];

describe('memberFills', () => {
  it('gives the other members of a full pod five different colours, in pod order, skipping the viewer', () => {
    const fillOf = memberFills(SIX, 'me');
    const fills = ['a', 'b', 'c', 'd', 'e'].map((m) => fillOf(m));
    expect(fills).toEqual([...AvatarFills]);
    expect(new Set(fills.map((f) => f.bg)).size).toBe(5);
  });

  it('keeps each member in the same colour wherever the same pod is drawn', () => {
    expect(memberFills(SIX, 'me')('c')).toBe(memberFills(SIX, 'me')('c'));
  });

  it('never puts the green fill on the green hero', () => {
    const fillOf = memberFills(SIX, 'me', true);
    const bgs = ['a', 'b', 'c', 'd', 'e'].map((m) => fillOf(m).bg);
    expect(bgs).not.toContain(Colors.light.forest);
    expect(new Set(bgs).size).toBe(5);
  });

  it('matches the storyboards for a five-person pod', () => {
    const fillOf = memberFills(['mette', 'jonas', 'sofie', 'ahmed', 'me'], 'me', true);
    expect(['mette', 'jonas', 'sofie', 'ahmed'].map((m) => fillOf(m).bg)).toEqual(['#F7D58E', '#8DBFAE', '#CFC6EE', '#F4C2B0']);
  });
});

describe('viewerLast', () => {
  it('moves the viewer to the end and leaves the others in pod order', () => {
    expect(viewerLast(SIX, 'me')).toEqual(['a', 'b', 'c', 'd', 'e', 'me']);
    expect(viewerLast(['a', 'b'], 'me')).toEqual(['a', 'b']);
  });
});
