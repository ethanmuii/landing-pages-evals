import { isTag, isText, type ChildNode, type Element } from 'domhandler';

const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img',
  'input', 'link', 'meta', 'source', 'track', 'wbr',
]);

// Text inside these renders exactly as written, so collapsing runs there would
// erase content a reader can see.
const PREFORMATTED_TAGS = new Set(['pre', 'textarea']);

// Angular and Vue/Alpine bookkeeping, rewritten freely by their compilers.
const DROPPED_ATTRIBUTE_PREFIXES = ['data-', '_nghost', '_ngcontent', 'v-', 'x-'];

type Run =
  | { kind: 'element'; element: Element }
  | { kind: 'text'; data: string };

// Unlike src/locks/anchors.ts, which looks through transparent wrappers to find
// the nodes a reader would call neighbours, this is the literal subtree: a
// wrapper gained or lost is a real change and must show up as one.
export function canonicalize(element: Element): string {
  return serializeElement(element, false);
}

function serializeElement(element: Element, preformatted: boolean): string {
  const open = `<${element.name}${serializeAttributes(element)}>`;
  if (VOID_TAGS.has(element.name)) {
    return open;
  }
  const inside = preformatted || PREFORMATTED_TAGS.has(element.name);
  return `${open}${serializeChildren(element.children, inside)}</${element.name}>`;
}

function serializeChildren(children: ChildNode[], preformatted: boolean): string {
  const runs = runsOf(children);
  return runs
    .map((run, index) => (run.kind === 'element'
      ? serializeElement(run.element, preformatted)
      : serializeText(run.data, preformatted, index === 0, index === runs.length - 1)))
    .join('');
}

function runsOf(children: ChildNode[]): Run[] {
  const runs: Run[] = [];
  for (const child of children) {
    if (isTag(child)) {
      runs.push({ kind: 'element', element: child });
      continue;
    }
    if (!isText(child)) {
      continue;
    }
    // A removed comment must not leave a seam: text that was split around it
    // joins back into one run, so `a <!--c--> b` collapses like `a b`.
    const last = runs.at(-1);
    if (last?.kind === 'text') {
      last.data += child.data;
    } else {
      runs.push({ kind: 'text', data: child.data });
    }
  }
  return runs;
}

function serializeText(data: string, preformatted: boolean, first: boolean, last: boolean): string {
  if (preformatted) {
    return escapeText(data);
  }
  // JavaScript's \s already spans tab, newline, carriage return, form feed, the
  // non-breaking space and the other Unicode separators, so any mixture of them
  // collapses together and a non-breaking space compares equal to a plain one.
  let text = data.replace(/\s+/gu, ' ');
  if (first) {
    text = text.replace(/^ /, '');
  }
  if (last) {
    text = text.replace(/ $/, '');
  }
  // Indentation between tags carries no content, so a run holding nothing but a
  // single space disappears instead of registering as a difference.
  return text === ' ' ? '' : escapeText(text);
}

function serializeAttributes(element: Element): string {
  return Object.keys(element.attribs)
    .filter(isRetained)
    .sort()
    .map((name) => ` ${name}="${escapeAttribute(element.attribs[name] ?? '')}"`)
    .join('');
}

// The appearance rule owns styling, so the whole class attribute goes rather
// than only the hashed-looking parts of it: content lives in text and
// structure. data-locked goes with the other data-* attributes because locating
// the lock has already consumed it and a committed baseline fragment need not
// carry it.
function isRetained(name: string): boolean {
  if (name === 'class' || name === 'style') {
    return false;
  }
  return !DROPPED_ATTRIBUTE_PREFIXES.some((prefix) => name.startsWith(prefix));
}

function escapeText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttribute(value: string): string {
  return escapeText(value).replace(/"/g, '&quot;');
}
