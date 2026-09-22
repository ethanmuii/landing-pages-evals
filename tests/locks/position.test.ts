import { describe, expect, it } from 'vitest';
import type { RelationalMarkers } from '../../src/contracts/relational-markers.js';
import { extractRelationalMarkers } from '../../src/locks/anchors.js';
import { locateLock, parsePage } from '../../src/locks/locate.js';
import { positionFinding } from '../../src/locks/position.js';

const pagePath = 'fixtures/page.html';
const domPath = 'main > footer';

const markers = (
  parentTag: string,
  previousSiblingTag: string | null,
  nextSiblingTag: string | null,
): RelationalMarkers => ({ parentTag, previousSiblingTag, nextSiblingTag });

const baseline = markers('main', 'section', 'aside');

describe('matching anchors', () => {
  it('builds the exact passing position finding', () => {
    expect(positionFinding('footer', pagePath, domPath, baseline, markers('main', 'section', 'aside'))).toEqual({
      lockId: 'footer',
      rule: 'position',
      pagePath,
      domPath,
      verdict: 'pass',
      confidence: null,
      checker: 'relational_position_anchor',
      reason: 'Position check passed: lock is still inside main between section and aside.',
    });
  });

  it('passes with both siblings null and names them nothing', () => {
    const onlyChild = markers('main', null, null);
    expect(positionFinding('footer', pagePath, domPath, onlyChild, markers('main', null, null))).toEqual({
      lockId: 'footer',
      rule: 'position',
      pagePath,
      domPath,
      verdict: 'pass',
      confidence: null,
      checker: 'relational_position_anchor',
      reason: 'Position check passed: lock is still inside main between nothing and nothing.',
    });
  });

  it('treats the same tag on both sides as equal', () => {
    const between = markers('main', 'section', 'section');
    const finding = positionFinding('footer', pagePath, domPath, between, markers('main', 'section', 'section'));
    expect(finding.verdict).toBe('pass');
    expect(finding.reason).toBe('Position check passed: lock is still inside main between section and section.');
  });
});

describe('a single differing anchor', () => {
  it.each([
    [
      'parent',
      markers('aside', 'section', 'aside'),
      'Position check failed: parent changed from main to aside.',
    ],
    [
      'previous sibling',
      markers('main', 'nav', 'aside'),
      'Position check failed: previous sibling changed from section to nav.',
    ],
    [
      'next sibling',
      markers('main', 'section', 'nav'),
      'Position check failed: next sibling changed from aside to nav.',
    ],
  ])('fails on a changed %s', (_label, generated, reason) => {
    const finding = positionFinding('footer', pagePath, domPath, baseline, generated);
    expect(finding.verdict).toBe('fail');
    expect(finding.reason).toBe(reason);
  });
});

describe('several differing anchors', () => {
  it('lists two differences in parent then sibling order', () => {
    const finding = positionFinding('footer', pagePath, domPath, baseline, markers('aside', 'section', 'nav'));
    expect(finding.reason).toBe(
      'Position check failed: parent changed from main to aside; next sibling changed from aside to nav.',
    );
  });

  it('lists three differences in parent, previous, next order', () => {
    const finding = positionFinding('footer', pagePath, domPath, baseline, markers('aside', 'nav', 'p'));
    expect(finding.reason).toBe(
      'Position check failed: parent changed from main to aside; previous sibling changed from section to nav; next sibling changed from aside to p.',
    );
  });
});

describe('null against a tag', () => {
  it.each([
    [
      markers('main', null, 'aside'),
      markers('main', 'section', 'aside'),
      'Position check failed: previous sibling changed from nothing to section.',
    ],
    [
      markers('main', 'section', 'aside'),
      markers('main', null, 'aside'),
      'Position check failed: previous sibling changed from section to nothing.',
    ],
    [
      markers('main', 'section', null),
      markers('main', 'section', 'aside'),
      'Position check failed: next sibling changed from nothing to aside.',
    ],
    [
      markers('main', 'section', 'aside'),
      markers('main', 'section', null),
      'Position check failed: next sibling changed from aside to nothing.',
    ],
  ])('fails and renders nothing on the correct side (%#)', (from, to, reason) => {
    const finding = positionFinding('footer', pagePath, domPath, from, to);
    expect(finding.verdict).toBe('fail');
    expect(finding.reason).toBe(reason);
  });
});

describe('identity pass-through', () => {
  it.each([
    ['footer', 'fixtures/page.html', 'main > footer'],
    ['hero cta', 'fixtures/landing page.html', 'main > div:nth-child(2) > a'],
    ['say "hi"', 'fixtures/"quoted".html', 'main > [data-locked="say \\"hi\\""]'],
  ])('copies lockId, pagePath and domPath verbatim (%#)', (lockId, page, dom) => {
    const finding = positionFinding(lockId, page, dom, baseline, markers('aside', 'nav', 'p'));
    expect(finding.lockId).toBe(lockId);
    expect(finding.pagePath).toBe(page);
    expect(finding.domPath).toBe(dom);
  });
});

describe('schema enforcement', () => {
  it.each(['', '   '])('rejects a blank pagePath (%j)', (blank) => {
    expect(() => positionFinding('footer', blank, domPath, baseline, baseline)).toThrow();
  });

  it.each(['', '   '])('rejects a blank domPath (%j)', (blank) => {
    expect(() => positionFinding('footer', pagePath, blank, baseline, baseline)).toThrow();
  });
});

describe('against a parsed page', () => {
  const html = '<main><section>A</section><footer data-locked="lock">F</footer><aside>B</aside></main>';

  function generatedMarkers(source: string): RelationalMarkers {
    const location = locateLock(parsePage(source), 'lock');
    if (location.outcome !== 'found') {
      throw new Error(`Expected found, received ${location.outcome}`);
    }
    return extractRelationalMarkers(location.element);
  }

  it('passes when the generated page keeps the baseline anchors', () => {
    const finding = positionFinding('lock', pagePath, domPath, baseline, generatedMarkers(html));
    expect(finding.verdict).toBe('pass');
    expect(finding.reason).toBe('Position check passed: lock is still inside main between section and aside.');
  });

  it('fails when the generated page moves the lock', () => {
    const moved = '<main><aside>B</aside><nav>N</nav><footer data-locked="lock">F</footer></main>';
    const finding = positionFinding('lock', pagePath, domPath, baseline, generatedMarkers(moved));
    expect(finding.verdict).toBe('fail');
    expect(finding.reason).toBe(
      'Position check failed: previous sibling changed from section to nav; next sibling changed from aside to nothing.',
    );
  });
});
