import { describe, expect, it } from 'vitest';
import { isTag, type Element } from 'domhandler';
import { relationalMarkersSchema } from '../../src/contracts/relational-markers.js';
import { extractRelationalMarkers, isTransparentWrapper } from '../../src/locks/anchors.js';
import { locateLock, parsePage, type PageDocument } from '../../src/locks/locate.js';

function lockElement($: PageDocument, lockId: string): Element {
  const location = locateLock($, lockId);
  if (location.outcome !== 'found') {
    throw new Error(`Expected found, received ${location.outcome}`);
  }
  return location.element;
}

function firstElement($: PageDocument, selector: string): Element {
  const node = $(selector).get(0);
  if (node === undefined || !isTag(node)) {
    throw new Error(`No element matches ${selector}`);
  }
  return node;
}

function markersFor(html: string, lockId = 'lock') {
  return extractRelationalMarkers(lockElement(parsePage(html), lockId));
}

describe('isTransparentWrapper', () => {
  it.each([
    '<div></div>',
    '<span></span>',
    '<div class="wrap"></div>',
  ])('treats %s as transparent', (html) => {
    const $ = parsePage(`<main>${html}</main>`);
    expect(isTransparentWrapper(firstElement($, 'main > *'))).toBe(true);
  });

  it.each([
    '<div role="region"></div>',
    '<div role=""></div>',
    '<div id="hero"></div>',
    '<div id=""></div>',
    '<div aria-label="Hero"></div>',
    '<div aria-label=""></div>',
    '<div data-locked="x"></div>',
    '<div data-locked=""></div>',
    '<span id="x"></span>',
  ])('treats %s as opaque because of its identity attribute', (html) => {
    const $ = parsePage(`<main>${html}</main>`);
    expect(isTransparentWrapper(firstElement($, 'main > *'))).toBe(false);
  });

  it.each([
    '<section></section>',
    '<nav></nav>',
    '<p></p>',
    '<footer></footer>',
  ])('treats %s as opaque by tag', (html) => {
    const $ = parsePage(`<main>${html}</main>`);
    expect(isTransparentWrapper(firstElement($, 'main > *'))).toBe(false);
  });
});

describe('plain siblings', () => {
  it('anchors on the parent and both element neighbours', () => {
    const markers = markersFor(
      '<main><section>A</section><footer data-locked="f">F</footer><aside>B</aside></main>',
      'f',
    );
    expect(markers).toEqual({ parentTag: 'main', previousSiblingTag: 'section', nextSiblingTag: 'aside' });
  });

  it('reports null on the previous side for a first child', () => {
    const markers = markersFor('<main><footer data-locked="lock">F</footer><aside>B</aside></main>');
    expect(markers).toEqual({ parentTag: 'main', previousSiblingTag: null, nextSiblingTag: 'aside' });
  });

  it('reports null on the next side for a last child', () => {
    const markers = markersFor('<main><section>A</section><footer data-locked="lock">F</footer></main>');
    expect(markers).toEqual({ parentTag: 'main', previousSiblingTag: 'section', nextSiblingTag: null });
  });

  it('reports null on both sides for an only child', () => {
    const markers = markersFor('<main><footer data-locked="lock">F</footer></main>');
    expect(markers).toEqual({ parentTag: 'main', previousSiblingTag: null, nextSiblingTag: null });
  });

  it('anchors a top-level lock on body', () => {
    const markers = markersFor('<header>H</header><footer data-locked="lock">F</footer>');
    expect(markers).toEqual({ parentTag: 'body', previousSiblingTag: 'header', nextSiblingTag: null });
  });
});

describe('non-element nodes', () => {
  it('ignores whitespace between siblings', () => {
    const markers = markersFor(`
      <main>
        <section>A</section>
        <footer data-locked="lock">F</footer>
        <aside>B</aside>
      </main>
    `);
    expect(markers).toEqual({ parentTag: 'main', previousSiblingTag: 'section', nextSiblingTag: 'aside' });
  });

  it('ignores bare text between siblings', () => {
    const markers = markersFor(
      '<main><section>A</section>before<footer data-locked="lock">F</footer>after<aside>B</aside></main>',
    );
    expect(markers).toEqual({ parentTag: 'main', previousSiblingTag: 'section', nextSiblingTag: 'aside' });
  });

  it('ignores comments between siblings', () => {
    const markers = markersFor(
      '<main><section>A</section><!-- c --><footer data-locked="lock">F</footer><!-- c --><aside>B</aside></main>',
    );
    expect(markers).toEqual({ parentTag: 'main', previousSiblingTag: 'section', nextSiblingTag: 'aside' });
  });

  it('reports null when the only neighbours are text nodes', () => {
    const markers = markersFor('<main>before<footer data-locked="lock">F</footer>after</main>');
    expect(markers).toEqual({ parentTag: 'main', previousSiblingTag: null, nextSiblingTag: null });
  });
});

describe('transparent ancestors', () => {
  it('sees through nested wrappers to the opaque parent and its neighbours', () => {
    const markers = markersFor(
      '<main><section>A</section><div><div class="wrap"><footer data-locked="lock">F</footer></div></div><aside>B</aside></main>',
    );
    expect(markers).toEqual({ parentTag: 'main', previousSiblingTag: 'section', nextSiblingTag: 'aside' });
  });

  it.each([
    'id="hero"',
    'role="region"',
    'aria-label="Hero"',
  ])('stops at a div carrying %s', (attribute) => {
    const markers = markersFor(`<main><div ${attribute}><footer data-locked="lock">F</footer></div></main>`);
    expect(markers).toEqual({ parentTag: 'div', previousSiblingTag: null, nextSiblingTag: null });
  });
});

describe('transparent siblings', () => {
  it('descends a previous wrapper to its last opaque descendant', () => {
    const markers = markersFor(
      '<main><div><p>x</p><ul><li>1</li></ul></div><footer data-locked="lock">F</footer></main>',
    );
    expect(markers.previousSiblingTag).toBe('ul');
  });

  it('descends a previous wrapper through nested wrappers to its last opaque descendant', () => {
    const markers = markersFor(
      '<main><div><p>x</p><div><ul><li>1</li></ul></div><div></div></div><footer data-locked="lock">F</footer></main>',
    );
    expect(markers.previousSiblingTag).toBe('ul');
  });

  it('descends a next wrapper through nested wrappers to its first opaque descendant', () => {
    const markers = markersFor(
      '<main><footer data-locked="lock">F</footer><div><div><h2>y</h2><p>z</p></div></div></main>',
    );
    expect(markers.nextSiblingTag).toBe('h2');
  });

  it('skips empty wrappers on the previous side', () => {
    const markers = markersFor(
      '<main><section>S</section><div></div><div><div></div></div><footer data-locked="lock">F</footer></main>',
    );
    expect(markers.previousSiblingTag).toBe('section');
  });

  it('skips empty wrappers on the next side', () => {
    const markers = markersFor(
      '<main><footer data-locked="lock">F</footer><div></div><div><div></div></div><aside>A</aside></main>',
    );
    expect(markers.nextSiblingTag).toBe('aside');
  });

  it('reports null when a side holds only empty wrappers', () => {
    const markers = markersFor(
      '<main><div><div></div></div><footer data-locked="lock">F</footer><span></span></main>',
    );
    expect(markers).toEqual({ parentTag: 'main', previousSiblingTag: null, nextSiblingTag: null });
  });
});

describe('nested locks', () => {
  it('anchors an inner lock on the outer lock element', () => {
    const markers = markersFor(
      '<section data-locked="outer"><p>Intro</p><div data-locked="inner">Inner</div></section>',
      'inner',
    );
    expect(markers).toEqual({ parentTag: 'section', previousSiblingTag: 'p', nextSiblingTag: null });
  });

  it('anchors a wrapped inner lock on the outer lock element', () => {
    const markers = markersFor(
      '<section data-locked="outer"><p>Intro</p><div><div data-locked="inner">Inner</div></div></section>',
      'inner',
    );
    expect(markers).toEqual({ parentTag: 'section', previousSiblingTag: 'p', nextSiblingTag: null });
  });
});

describe('div locks', () => {
  it('treats a bare div lock as opaque and still resolves its markers', () => {
    const $ = parsePage('<main><section>A</section><div data-locked="lock">L</div><aside>B</aside></main>');
    const lock = lockElement($, 'lock');
    expect(isTransparentWrapper(lock)).toBe(false);
    expect(extractRelationalMarkers(lock)).toEqual({
      parentTag: 'main',
      previousSiblingTag: 'section',
      nextSiblingTag: 'aside',
    });
  });
});

describe('schema conformance', () => {
  it.each([
    '<main><section>A</section><footer data-locked="lock">F</footer><aside>B</aside></main>',
    '<main><footer data-locked="lock">F</footer></main>',
  ])('produces markers accepted by the schema for %s', (html) => {
    expect(relationalMarkersSchema.safeParse(markersFor(html)).success).toBe(true);
  });
});
