/**
 * Translations with bold words in them ("Some of you also share **sourdough** and **trail running**"): the
 * translation keeps its own word order; its placeholders are filled with `slot(i)` and then swapped for nodes.
 *
 *   richText(t('pods.alsoShare', { list: slot(0) }), [boldList(t, wordings)])
 */
import { Fragment, type ReactNode } from 'react';
import type { TFunction } from 'i18next';
import { Strong } from '@/components/ui';

const MARK = '\u0000';

/** A placeholder value for the i-th node. */
export function slot(i: number): string {
  return `${MARK}${i}${MARK}`;
}

/** Splits a translated string at its slots and puts the nodes in their places. */
export function richText(text: string, nodes: readonly ReactNode[]): ReactNode[] {
  return text.split(MARK).map((part, i) => <Fragment key={i}>{i % 2 === 0 ? part : (nodes[Number(part)] ?? null)}</Fragment>);
}

/** "a", "a and b", "a, b and c", each item in bold (the viewer's own wordings). */
export function boldList(t: TFunction, items: readonly string[]): ReactNode {
  const and = t('pods.and');
  return items.map((item, i) => (
    <Fragment key={`${item}-${i}`}>
      {i === 0 ? '' : i === items.length - 1 ? ` ${and} ` : ', '}
      <Strong>{item}</Strong>
    </Fragment>
  ));
}
