import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import type { StructuralJudgeInput } from '../judge/request.js';
import { parsePage } from '../locks/locate.js';
import { canonicalize } from './canonical.js';

export type StructuralComparison =
  | { status: 'identical' }
  | ({ status: 'ambiguous' } & StructuralJudgeInput);

// Serializing an element needs a CheerioAPI but not the document the element
// came from, so one empty instance renders subtrees out of any parse.
const renderer = cheerio.load('');

export function baselineSubtreeRoot(fragmentHtml: string): Element {
  // Cheerio's children() already skips text and comment nodes, so surrounding
  // whitespace and a leading comment cannot be mistaken for a second root.
  const roots = parsePage(fragmentHtml)('body').children().toArray();
  const root = roots[0];
  if (root === undefined || roots.length !== 1) {
    throw new Error(`Baseline fragment must contain exactly one root element, found ${roots.length}`);
  }
  return root;
}

export function compareStructure(
  baselineRoot: Element,
  generatedRoot: Element,
): StructuralComparison {
  if (canonicalize(baselineRoot) === canonicalize(generatedRoot)) {
    return { status: 'identical' };
  }

  // Canonicalization has already absorbed every difference the normalizer knows
  // how to explain, so what is left is not a failure it can declare: only a
  // model can say whether the remaining difference matters.
  //
  // The raw markup goes out rather than the canonical form the comparison just
  // used, because the rubric instructs the judge to ignore classes, inline
  // styles and framework hashes, which it can only do while it can see them.
  return {
    status: 'ambiguous',
    baselineHtml: renderer.html(baselineRoot),
    generatedHtml: renderer.html(generatedRoot),
  };
}
