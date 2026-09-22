import { describe, expect, it } from 'vitest';
import { contentFinding } from '../../src/browser/content.js';
import type { LockMeasurement } from '../../src/browser/extract.js';

const pagePath = 'fixtures/page.html';
const domPath = 'main > footer';

function measurement(visibleText: string): LockMeasurement {
  return { visibleText, computedStyles: {}, width: 320, height: 48 };
}

const passReason = 'Content check passed: visible text matches the baseline exactly.';
const failReason = 'Content check failed: visible text changed.';

describe('matching text', () => {
  it('builds the exact passing content finding', () => {
    expect(contentFinding('footer', pagePath, domPath, 'Ship it today', measurement('Ship it today'))).toEqual({
      lockId: 'footer',
      rule: 'content',
      pagePath,
      domPath,
      verdict: 'pass',
      confidence: null,
      checker: 'deterministic_content_normalizer',
      reason: passReason,
    });
  });

  it('passes when both sides are empty', () => {
    const finding = contentFinding('footer', pagePath, domPath, '', measurement(''));
    expect(finding.verdict).toBe('pass');
    expect(finding.reason).toBe(passReason);
  });
});

describe('changed text', () => {
  it('builds the exact failing content finding', () => {
    expect(contentFinding('footer', pagePath, domPath, 'Ship it today', measurement('Ship it tomorrow'))).toEqual({
      lockId: 'footer',
      rule: 'content',
      pagePath,
      domPath,
      verdict: 'fail',
      confidence: null,
      checker: 'deterministic_content_normalizer',
      reason: failReason,
    });
  });

  it.each([
    ['case', 'Hello', 'hello'],
    ['punctuation', 'Hi.', 'Hi!'],
    ['a trailing period', 'Buy now', 'Buy now.'],
    ['an emptied lock', 'Buy now', ''],
    ['a filled empty lock', '', 'Buy now'],
  ])('fails on a difference of %s', (_label, baselineText, visibleText) => {
    const finding = contentFinding('footer', pagePath, domPath, baselineText, measurement(visibleText));
    expect(finding.verdict).toBe('fail');
    expect(finding.reason).toBe(failReason);
  });
});

describe('baseline normalization', () => {
  it.each([
    ['ragged spacing', '  Ship   it  today '],
    ['newlines', 'Ship\nit\ntoday'],
    ['a tab and a newline', 'Ship\t it\r\n today'],
    ['a non-breaking space', 'Ship it today'],
    ['every separator at once', '\n Ship   it\t\ttoday \n'],
  ])('compares equal when the baseline carries %s', (_label, baselineText) => {
    const finding = contentFinding('footer', pagePath, domPath, baselineText, measurement('Ship it today'));
    expect(finding.verdict).toBe('pass');
    expect(finding.reason).toBe(passReason);
  });

  it('still fails when normalization cannot rescue different words', () => {
    const finding = contentFinding('footer', pagePath, domPath, ' Ship\n it  now ', measurement('Ship it today'));
    expect(finding.verdict).toBe('fail');
  });
});

describe('the reason never quotes the copy', () => {
  it('omits the changed word from a failing reason', () => {
    const finding = contentFinding('footer', pagePath, domPath, 'Ship it today', measurement('Ship it tomorrow'));
    expect(finding.reason).not.toContain('tomorrow');
    expect(finding.reason).not.toContain('today');
  });
});

describe('identity pass-through', () => {
  it.each([
    ['footer', 'fixtures/page.html', 'main > footer'],
    ['hero cta', 'fixtures/landing page.html', 'main > div:nth-child(2) > a'],
    ['say "hi"', 'fixtures/"quoted".html', 'main > [data-locked="say \\"hi\\""]'],
  ])('copies lockId, pagePath and domPath verbatim (%#)', (lockId, page, dom) => {
    const finding = contentFinding(lockId, page, dom, 'Ship it today', measurement('Ship it now'));
    expect(finding.lockId).toBe(lockId);
    expect(finding.pagePath).toBe(page);
    expect(finding.domPath).toBe(dom);
  });
});

describe('schema enforcement', () => {
  it.each(['', '   '])('rejects a blank pagePath (%j)', (blank) => {
    expect(() => contentFinding('footer', blank, domPath, 'Ship it', measurement('Ship it'))).toThrow();
  });

  it.each(['', '   '])('rejects a blank domPath (%j)', (blank) => {
    expect(() => contentFinding('footer', pagePath, blank, 'Ship it', measurement('Ship it'))).toThrow();
  });
});
