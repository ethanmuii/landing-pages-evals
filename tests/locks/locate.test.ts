import { describe, expect, it } from 'vitest';
import { LOCK_ATTRIBUTE, locateLock, parsePage, type LockLocation } from '../../src/locks/locate.js';

function expectFound(location: LockLocation) {
  if (location.outcome !== 'found') {
    throw new Error(`Expected found, received ${location.outcome}`);
  }
  return location;
}

describe('lock attribute', () => {
  it('names the data-locked attribute', () => {
    expect(LOCK_ATTRIBUTE).toBe('data-locked');
  });
});

describe('single lock lookup', () => {
  it('returns the one element carrying the exact lock id', () => {
    const $ = parsePage(`
      <header id="top" data-locked="header">Header</header>
      <main><section class="hero">Hero</section></main>
      <footer id="bottom" class="legal" data-locked="footer">Footer</footer>
    `);
    const location = expectFound(locateLock($, 'footer'));
    expect(location).toMatchObject({ outcome: 'found', lockId: 'footer', matchCount: 1 });
    expect(location.element.tagName).toBe('footer');
    expect($(location.element).attr('data-locked')).toBe('footer');
    expect($(location.element).attr('id')).toBe('bottom');
    expect($(location.element).hasClass('legal')).toBe(true);
  });
});

describe('absent lock', () => {
  it('reports absent when no element carries the attribute', () => {
    const $ = parsePage('<main><footer id="footer">Footer</footer></main>');
    expect(locateLock($, 'footer')).toEqual({ outcome: 'absent', lockId: 'footer', matchCount: 0 });
  });

  it('reports absent when other locks exist but not the requested id', () => {
    const $ = parsePage(`
      <header data-locked="header">Header</header>
      <aside data-locked="sidebar">Sidebar</aside>
    `);
    expect(locateLock($, 'footer')).toEqual({ outcome: 'absent', lockId: 'footer', matchCount: 0 });
  });
});

describe('duplicate lock', () => {
  it('reports two copies within the same parent', () => {
    const $ = parsePage(`
      <main>
        <footer data-locked="footer">One</footer>
        <footer data-locked="footer">Two</footer>
      </main>
    `);
    expect(locateLock($, 'footer')).toEqual({ outcome: 'duplicate', lockId: 'footer', matchCount: 2 });
  });

  it('reports three copies spread across different parents', () => {
    const $ = parsePage(`
      <header><div data-locked="footer">One</div></header>
      <main><footer data-locked="footer">Two</footer></main>
      <aside><span data-locked="footer">Three</span></aside>
    `);
    expect(locateLock($, 'footer')).toEqual({ outcome: 'duplicate', lockId: 'footer', matchCount: 3 });
  });
});

describe('nested locks', () => {
  const $ = parsePage(`
    <section id="wrapper" data-locked="outer">
      <p>Intro</p>
      <div id="content" data-locked="inner">Inner</div>
    </section>
  `);

  it('locates the outer lock whose subtree contains the inner lock', () => {
    const location = expectFound(locateLock($, 'outer'));
    expect(location.element.tagName).toBe('section');
    expect($(location.element).attr('id')).toBe('wrapper');
    expect($(location.element).html()).toContain('data-locked="inner"');
  });

  it('locates the inner lock as a single match nested under the outer lock', () => {
    const location = expectFound(locateLock($, 'inner'));
    expect(location.element.tagName).toBe('div');
    expect($(location.element).attr('id')).toBe('content');
    expect(location.matchCount).toBe(1);
    expect($(location.element).parent().attr('data-locked')).toBe('outer');
  });
});

describe('special-character lock ids', () => {
  it.each([
    { lockId: 'say "hi"', html: `<div id="target" data-locked='say "hi"'></div><div data-locked='say "hi'></div>` },
    { lockId: 'say "hi"', html: `<div id="target" data-locked="say &quot;hi&quot;"></div><div data-locked="say &quot;hi"></div>` },
    { lockId: 'a&b', html: `<div id="target" data-locked="a&amp;b"></div><div data-locked="a&amp;amp;b"></div>` },
    { lockId: "it's", html: `<div id="target" data-locked="it's"></div><div data-locked="its"></div>` },
    { lockId: 'close]', html: `<div id="target" data-locked="close]"></div><div data-locked="close"></div>` },
    { lockId: '[open', html: `<div id="target" data-locked="[open"></div><div data-locked="open"></div>` },
    { lockId: 'back\\slash', html: `<div id="target" data-locked="back\\slash"></div><div data-locked="backslash"></div>` },
    { lockId: 'two words', html: `<div id="target" data-locked="two words"></div><div data-locked="two-words"></div>` },
    { lockId: 'pied-de-page-é', html: `<div id="target" data-locked="pied-de-page-é"></div><div data-locked="pied-de-page-e"></div>` },
    { lockId: '页脚', html: `<div id="target" data-locked="页脚"></div><div data-locked="页"></div>` },
  ])('resolves $lockId by exact equality alongside a decoy', ({ lockId, html }) => {
    const $ = parsePage(html);
    const location = expectFound(locateLock($, lockId));
    expect(location.matchCount).toBe(1);
    expect($(location.element).attr('id')).toBe('target');
    expect($(location.element).attr('data-locked')).toBe(lockId);
  });
});

describe('near-miss lock ids', () => {
  it.each([
    { present: 'footer-legal', requested: 'footer' },
    { present: 'Footer', requested: 'footer' },
    { present: ' footer', requested: 'footer' },
    { present: 'footer ', requested: 'footer' },
    { present: 'footer', requested: 'footer-legal' },
    { present: 'footer', requested: 'Footer' },
    { present: 'footer', requested: ' footer' },
    { present: 'footer', requested: 'footer ' },
  ])('does not match $requested when only $present is present', ({ present, requested }) => {
    const $ = parsePage(`<footer data-locked="${present}">Footer</footer>`);
    expect(locateLock($, requested)).toEqual({ outcome: 'absent', lockId: requested, matchCount: 0 });
  });
});

describe('attribute name handling', () => {
  it('finds an element whose attribute name is upper-cased in source', () => {
    const $ = parsePage('<footer id="target" DATA-LOCKED="x">Footer</footer>');
    const location = expectFound(locateLock($, 'x'));
    expect($(location.element).attr('id')).toBe('target');
  });

  it.each([
    '<footer data-lock="footer">Footer</footer>',
    '<footer data-locked-id="footer">Footer</footer>',
    '<footer id="footer">Footer</footer>',
  ])('ignores look-alike attributes: %s', (html) => {
    expect(locateLock(parsePage(html), 'footer')).toEqual({ outcome: 'absent', lockId: 'footer', matchCount: 0 });
  });
});

describe('parse-once contract', () => {
  it('answers repeated lookups consistently from a single parsed document', () => {
    const $ = parsePage(`
      <header data-locked="header">Header</header>
      <footer data-locked="footer">Footer</footer>
      <footer data-locked="footer">Footer</footer>
    `);
    const firstHeader = locateLock($, 'header');
    const firstFooter = locateLock($, 'footer');
    const firstMissing = locateLock($, 'missing');

    expect(locateLock($, 'header')).toEqual(firstHeader);
    expect(locateLock($, 'footer')).toEqual(firstFooter);
    expect(locateLock($, 'missing')).toEqual(firstMissing);
    expect(firstHeader.outcome).toBe('found');
    expect(firstFooter).toEqual({ outcome: 'duplicate', lockId: 'footer', matchCount: 2 });
    expect(firstMissing).toEqual({ outcome: 'absent', lockId: 'missing', matchCount: 0 });
  });
});
