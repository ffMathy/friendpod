import { Fragment, type ReactNode } from 'react';
import { Text } from 'react-native';
import { Fonts } from '@/components/theme';

/**
 * Bold words inside a translated sentence ("Everyone added **brætspil**, or something that means the same."), without
 * markup in the strings: the caller translates with `slot(i)` as the value, and `fill` swaps each slot for a node.
 * User wordings never pass through a parser. Private-use characters cannot occur in the translations.
 */
const SLOT = /(\d+)/;

export function slot(index: number): string {
  return `${index}`;
}

export function fill(sentence: string, nodes: readonly ReactNode[]): ReactNode[] {
  return sentence.split(SLOT).map((part, i) =>
    i % 2 === 1 ? <Fragment key={i}>{nodes[Number(part)]}</Fragment> : part ? <Fragment key={i}>{part}</Fragment> : null,
  );
}

/** A bold run inside an AppText (inherits its size and colour). */
export function Bold({ children }: { children: ReactNode }) {
  return <Text style={Fonts.bold}>{children}</Text>;
}

/** "a, b and c" with each item bold; `and` is the translated conjunction. */
export function boldList(items: readonly string[], and: string): ReactNode {
  return items.map((item, i) => (
    <Fragment key={i}>
      {i === 0 ? '' : i === items.length - 1 ? ` ${and} ` : ', '}
      <Bold>{item}</Bold>
    </Fragment>
  ));
}
