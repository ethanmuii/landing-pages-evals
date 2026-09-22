import { isTag, type Element } from 'domhandler';
import type { RelationalMarkers } from '../contracts/relational-markers.js';

const TRANSPARENT_TAGS = new Set(['div', 'span']);
const NON_RENDERING_TAGS = new Set(['script', 'style', 'template', 'link', 'meta', 'noscript']);
const IDENTITY_ATTRIBUTES = ['role', 'id', 'aria-label', 'data-locked'];

type Direction = 'prev' | 'next';

export function isTransparentWrapper(element: Element): boolean {
  return TRANSPARENT_TAGS.has(element.name)
    && !IDENTITY_ATTRIBUTES.some((attribute) => attribute in element.attribs);
}

// A transparent wrapper still contributes the content it holds, whereas a
// non-rendering element paints nothing at all: it is passed over entirely
// instead of being looked through, so the two categories stay separate.
function isNonRendering(element: Element): boolean {
  return NON_RENDERING_TAGS.has(element.name);
}

export function extractRelationalMarkers(element: Element): RelationalMarkers {
  const { macro, parent } = findMacroNode(element);
  return {
    parentTag: parent.name,
    previousSiblingTag: siblingAnchor(macro, 'prev'),
    nextSiblingTag: siblingAnchor(macro, 'next'),
  };
}

// A lock alone inside layout wrappers has no neighbours of its own, so its real
// neighbours are the wrapper's: the macro node. A lock that already sits beside
// real siblings keeps them, because climbing out of a shared container would
// discard the very elements the anchor is meant to describe.
function findMacroNode(element: Element): { macro: Element; parent: Element } {
  let macro = element;
  for (;;) {
    const parent = macro.parent;
    if (parent === null || !isTag(parent)) {
      throw new Error(`Lock element <${element.name}> has no opaque ancestor`);
    }
    const opaqueParent = !isTransparentWrapper(parent) && !isNonRendering(parent);
    if (opaqueParent) {
      return { macro, parent };
    }
    if (hasElementSibling(macro)) {
      return { macro, parent: nearestOpaqueAncestor(element) };
    }
    macro = parent;
  }
}

function hasElementSibling(node: Element): boolean {
  for (const direction of ['prev', 'next'] as const) {
    for (let sibling = node[direction]; sibling !== null; sibling = sibling[direction]) {
      if (isTag(sibling) && !isNonRendering(sibling)) {
        return true;
      }
    }
  }
  return false;
}

function nearestOpaqueAncestor(element: Element): Element {
  for (let node = element.parent; node !== null && isTag(node); node = node.parent) {
    if (!isTransparentWrapper(node) && !isNonRendering(node)) {
      return node;
    }
  }
  throw new Error(`Lock element <${element.name}> has no opaque ancestor`);
}

function siblingAnchor(macro: Element, direction: Direction): string | null {
  for (let sibling = macro[direction]; sibling !== null; sibling = sibling[direction]) {
    if (!isTag(sibling) || isNonRendering(sibling)) {
      continue;
    }
    const anchor = isTransparentWrapper(sibling) ? edgeOpaqueDescendant(sibling, direction) : sibling;
    if (anchor !== null) {
      return anchor.name;
    }
  }
  return null;
}

// A transparent sibling contributes the opaque content at its edge facing the
// lock, since that is what actually sits next to the lock on the page.
function edgeOpaqueDescendant(wrapper: Element, direction: Direction): Element | null {
  const children = wrapper.children.filter(isTag);
  if (direction === 'prev') {
    children.reverse();
  }
  for (const child of children) {
    if (isNonRendering(child)) {
      continue;
    }
    const found = isTransparentWrapper(child) ? edgeOpaqueDescendant(child, direction) : child;
    if (found !== null) {
      return found;
    }
  }
  return null;
}
