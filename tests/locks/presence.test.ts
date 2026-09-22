import { describe, expect, it } from 'vitest';
import { locateLock, parsePage } from '../../src/locks/locate.js';
import { presenceFinding } from '../../src/locks/presence.js';

const pagePath = 'fixtures/page.html';

const absentReason = (lockId: string) =>
  `Presence check failed: Element carrying data-locked="${lockId}" is entirely missing from the markup.`;
const duplicateReason = (lockId: string, matchCount: number) =>
  `Presence check failed: Found ${matchCount} duplicate instances of data-locked="${lockId}". Elements must be unique per page.`;

describe('absent lock finding', () => {
  it('builds the exact structural ambiguity finding', () => {
    const finding = presenceFinding({ outcome: 'absent', lockId: 'footer', matchCount: 0 }, pagePath);
    expect(finding).toEqual({
      lockId: 'footer',
      rule: 'structural_ambiguity',
      pagePath,
      domPath: 'NOT_FOUND',
      verdict: 'fail',
      confidence: null,
      checker: 'presence_precondition',
      reason: absentReason('footer'),
    });
  });
});

describe('duplicate lock finding', () => {
  it.each([2, 3])('builds the exact finding for %i copies', (matchCount) => {
    const finding = presenceFinding({ outcome: 'duplicate', lockId: 'footer', matchCount }, pagePath);
    expect(finding).toEqual({
      lockId: 'footer',
      rule: 'structural_ambiguity',
      pagePath,
      domPath: 'NOT_FOUND',
      verdict: 'fail',
      confidence: null,
      checker: 'presence_precondition',
      reason: duplicateReason('footer', matchCount),
    });
  });
});

describe('verbatim identity', () => {
  const spacedPath = '../pages/landing page.html';

  it.each(['say "hi"', ' footer '])('embeds lock id %j unescaped in an absent finding', (lockId) => {
    const finding = presenceFinding({ outcome: 'absent', lockId, matchCount: 0 }, spacedPath);
    expect(finding.lockId).toBe(lockId);
    expect(finding.pagePath).toBe(spacedPath);
    expect(finding.reason).toBe(absentReason(lockId));
  });

  it.each(['say "hi"', ' footer '])('embeds lock id %j unescaped in a duplicate finding', (lockId) => {
    const finding = presenceFinding({ outcome: 'duplicate', lockId, matchCount: 2 }, spacedPath);
    expect(finding.lockId).toBe(lockId);
    expect(finding.pagePath).toBe(spacedPath);
    expect(finding.reason).toBe(duplicateReason(lockId, 2));
  });

  it('renders a quoted id with the raw quote inside the reason', () => {
    const finding = presenceFinding({ outcome: 'absent', lockId: 'say "hi"', matchCount: 0 }, pagePath);
    expect(finding.reason).toBe(
      'Presence check failed: Element carrying data-locked="say "hi"" is entirely missing from the markup.',
    );
  });
});

describe('integration with locate', () => {
  const $ = parsePage(`
    <header data-locked="header">Header</header>
    <footer data-locked="footer">One</footer>
    <footer data-locked="footer">Two</footer>
  `);

  it('turns a missing lock into an absent finding', () => {
    const location = locateLock($, 'missing');
    if (location.outcome === 'found') {
      throw new Error('Expected missing lock to be unresolved');
    }
    const finding = presenceFinding(location, pagePath);
    expect(finding.lockId).toBe('missing');
    expect(finding.reason).toBe(absentReason('missing'));
  });

  it('turns a duplicated lock into a duplicate finding with the match count', () => {
    const location = locateLock($, 'footer');
    if (location.outcome === 'found') {
      throw new Error('Expected duplicated lock to be unresolved');
    }
    expect(location.matchCount).toBe(2);
    const finding = presenceFinding(location, pagePath);
    expect(finding.lockId).toBe('footer');
    expect(finding.reason).toBe(duplicateReason('footer', 2));
  });
});

describe('type-level rejection of found locations', () => {
  it('excludes found locations at compile time', () => {
    // Never invoked. Vitest strips types, so this case is enforced only by the
    // typecheck script: the body must fail tsc without the directive.
    const rejectFound = () => {
      // @ts-expect-error a found location is not an unresolved location
      presenceFinding({ outcome: 'found', lockId: 'footer', matchCount: 1, element: {} as never }, pagePath);
    };
    expect(typeof rejectFound).toBe('function');
  });
});

describe('blank page path', () => {
  it.each(['', '   '])('throws from the schema for %j', (blank) => {
    expect(() => presenceFinding({ outcome: 'absent', lockId: 'footer', matchCount: 0 }, blank)).toThrow();
    expect(() => presenceFinding({ outcome: 'duplicate', lockId: 'footer', matchCount: 2 }, blank)).toThrow();
  });
});
