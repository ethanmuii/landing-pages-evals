import { isTag, type Element } from 'domhandler';

// Unlike the relational anchors, which look through transparent wrappers to
// find the nodes a reader would call neighbours, this path is literal: every
// element between body and the lock becomes a segment, wrappers included, so
// that a path can be replayed against the markup exactly as it was parsed.
export function domPathOf(element: Element): string {
  const segments: string[] = [];
  for (let node = element; ; ) {
    if (node.name === 'body') {
      return ['body', ...segments].join('/');
    }
    segments.unshift(`${node.name}[${siblingIndexOf(node)}]`);
    const parent = node.parent;
    if (parent === null || !isTag(parent)) {
      throw new Error(`Element <${element.name}> is not inside a body`);
    }
    node = parent;
  }
}

function siblingIndexOf(node: Element): number {
  let index = 1;
  for (let sibling = node.prev; sibling !== null; sibling = sibling.prev) {
    if (isTag(sibling)) {
      index += 1;
    }
  }
  return index;
}
