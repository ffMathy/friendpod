import { AvatarFillGreen, AvatarFillOnForest, AvatarFills } from '@/components/theme';

/** A member's avatar colour: the circle and the initial on it. */
export interface MemberFill {
  readonly bg: string;
  readonly fg: string;
}

/**
 * Each member's colour on the pod screens (storyboards 3.1–3.5: hero, Members, the plan's voter stacks, the chat
 * header). The other members take the avatar fills in storyboard order, in the order `memberUids` lists them. The
 * viewer is skipped because they are always the ink "You" circle. A pod has at most six members, so its five or fewer
 * others never share a colour, and each keeps theirs on every pod screen. (A hash of the uid, as `avatarFill` does,
 * gives two members of a five-person pod the same colour in most pods.)
 *
 * Returns the lookup by uid. `onForest` is for the green hero: the green fill (only a six-person pod gets that far)
 * becomes its mint tint there.
 */
export function memberFills(memberUids: readonly string[], viewer: string, onForest = false): (memberUid: string) => MemberFill {
  const fills = new Map<string, MemberFill>();
  let next = 0;
  for (const memberUid of memberUids) {
    if (memberUid === viewer || fills.has(memberUid)) continue;
    const fill: MemberFill = AvatarFills[next % AvatarFills.length] ?? AvatarFills[0];
    next += 1;
    fills.set(memberUid, onForest && fill.bg === AvatarFillGreen.bg ? AvatarFillOnForest : fill);
  }
  // Someone not in `memberUids` (the viewer, drawn as "You" anyway) gets the first fill.
  return (memberUid) => fills.get(memberUid) ?? AvatarFills[0];
}

/**
 * `memberUids` with the viewer moved to the end: the order of the hero's avatars and of the voter stacks
 * (storyboards 3.1 and 3.2 draw "You" last).
 */
export function viewerLast(memberUids: readonly string[], viewer: string): readonly string[] {
  const others = memberUids.filter((memberUid) => memberUid !== viewer);
  return others.length === memberUids.length ? others : [...others, viewer];
}
