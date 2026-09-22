import { isTag, type Element } from 'domhandler';
import { describe, expect, it } from 'vitest';
import { domPathSchema } from '../../src/findings/identity.js';
import { domPathOf } from '../../src/locks/dom-path.js';
import { locateLock, parsePage, type PageDocument } from '../../src/locks/locate.js';
import { positionFinding } from '../../src/locks/position.js';

function lockElement(html: string, lockId = 'L'): Element {
  const location = locateLock(parsePage(html), lockId);
  if (location.outcome !== 'found') {
    throw new Error(`Expected found, received ${location.outcome}`);
  }
  return location.element;
}

function pathOfLock(html: string, lockId = 'L'): string {
  return domPathOf(lockElement(html, lockId));
}

function selectAll($: PageDocument, selector: string): Element[] {
  const elements = $(selector).toArray().filter(isTag);
  if (elements.length === 0) {
    throw new Error(`No element matched ${selector}`);
  }
  return elements;
}

describe('absolute paths from body', () => {
  it('names a lock that is the only child of body', () => {
    expect(pathOfLock('<footer data-locked="L">F</footer>')).toBe('body/footer[1]');
  });

  it('records one segment per level of nesting', () => {
    const html = '<main><section><footer data-locked="L">F</footer></section></main>';
    expect(pathOfLock(html)).toBe('body/main[1]/section[1]/footer[1]');
  });

  it('returns the bare body segment for the body itself', () => {
    const $ = parsePage('<main><footer data-locked="L">F</footer></main>');
    expect(domPathOf(selectAll($, 'body')[0]!)).toBe('body');
  });
});

describe('nth-child indexing over mixed tags', () => {
  it('counts preceding element siblings of any tag, not only same-tag siblings', () => {
    const html = '<main><p>P</p><span>S</span><footer data-locked="L">F</footer></main>';
    const path = pathOfLock(html);
    expect(path).toBe('body/main[1]/footer[3]');
    expect(path.split('/').at(-1)).toBe('footer[3]');
    expect(path).not.toContain('footer[1]');
  });
});

describe('segment boundaries', () => {
  const $ = parsePage(`<main>${'<x></x>'.repeat(12)}</main>`);
  const children = selectAll($, 'main > x');
  const path1 = domPathOf(children[0]!);
  const path10 = domPathOf(children[9]!);

  it('indexes the first and tenth siblings distinctly', () => {
    expect(path1).toBe('body/main[1]/x[1]');
    expect(path10).toBe('body/main[1]/x[10]');
  });

  it('keeps the tenth path from being a naive string prefix match of the first', () => {
    expect(path10.startsWith(path1)).toBe(false);
  });

  it('keeps x[1] and x[10] from being prefixes of each other as whole segments', () => {
    const segment1 = path1.split('/').at(-1)!;
    const segment10 = path10.split('/').at(-1)!;
    expect(segment1).toBe('x[1]');
    expect(segment10).toBe('x[10]');
    expect(segment10.startsWith(segment1)).toBe(false);
    expect(segment1.startsWith(segment10)).toBe(false);
  });
});

describe('non-element nodes', () => {
  it('ignores whitespace, text and comments when indexing', () => {
    const compact = '<main><p>P</p><span>S</span><footer data-locked="L">F</footer></main>';
    const interleaved = [
      '<main>',
      '  <p>P</p>',
      '  loose text',
      '  <span>S</span>',
      '  <!-- c -->',
      '  <footer data-locked="L">F</footer>',
      '</main>',
    ].join('\n');
    expect(pathOfLock(interleaved)).toBe(pathOfLock(compact));
    expect(pathOfLock(interleaved)).toBe('body/main[1]/footer[3]');
  });
});

describe('elements the relational anchors skip', () => {
  it('includes transparent wrappers as segments, unlike extractRelationalMarkers', () => {
    const html = '<main><div><div><footer data-locked="L">F</footer></div></div></main>';
    expect(pathOfLock(html)).toBe('body/main[1]/div[1]/div[1]/footer[1]');
  });

  it('counts non-rendering siblings, unlike extractRelationalMarkers', () => {
    const html = '<main><script></script><footer data-locked="L">F</footer></main>';
    expect(pathOfLock(html)).toBe('body/main[1]/footer[2]');
  });
});

describe('distinct locks', () => {
  it('gives two locks on one page different paths', () => {
    const html = '<main><section><a data-locked="one">A</a></section><section><a data-locked="two">B</a></section></main>';
    const first = pathOfLock(html, 'one');
    const second = pathOfLock(html, 'two');
    expect(first).toBe('body/main[1]/section[1]/a[1]');
    expect(second).toBe('body/main[1]/section[2]/a[1]');
    expect(first).not.toBe(second);
  });
});

describe('composition with the finding pieces', () => {
  const path = pathOfLock('<main><section><footer data-locked="L">F</footer></section></main>');

  it('produces a domPath the identity schema accepts', () => {
    expect(domPathSchema.parse(path)).toBe(path);
  });

  it('produces a domPath positionFinding carries into a schema-valid finding', () => {
    const anchors = { parentTag: 'section', previousSiblingTag: null, nextSiblingTag: null };
    const finding = positionFinding('L', 'fixtures/page.html', path, anchors, anchors);
    expect(finding.domPath).toBe('body/main[1]/section[1]/footer[1]');
    expect(finding.verdict).toBe('pass');
  });
});

describe('a realistic page', () => {
  it('names a lock nested deep among headers, sections and a footer', () => {
    const html = [
      '<header><nav><ul><li><a href="#">Home</a></li></ul></nav></header>',
      '<main>',
      '  <section id="hero"><h1>Hi</h1></section>',
      '  <section id="features"><div class="grid"><article>One</article><article>Two</article></div></section>',
      '  <section id="cta"><p>Ready?</p><a data-locked="L" href="#">Buy</a></section>',
      '</main>',
      '<footer><p>&copy;</p></footer>',
    ].join('\n');
    expect(pathOfLock(html)).toBe('body/main[2]/section[3]/a[2]');
  });
});
