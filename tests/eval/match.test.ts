import { describe, expect, it } from 'vitest';
import { labelSchema, type EvalLabel } from '../../src/eval/label.js';
import { domPathSegments, findingMatchesLabel, isSegmentPrefix } from '../../src/eval/match.js';
import { findingSchema, type Finding } from '../../src/findings/finding.js';

const makeFinding = (overrides: Record<string, unknown> = {}): Finding => findingSchema.parse({
  lockId: 'footer-legal',
  rule: 'content',
  pagePath: 'pages/pricing.html',
  domPath: 'body/main[1]/footer[3]',
  verdict: 'fail',
  confidence: null,
  reason: 'Normalized text no longer matches the baseline.',
  checker: 'deterministic_content_normalizer',
  ...overrides,
});

const makeLabel = (overrides: Record<string, unknown> = {}): EvalLabel => labelSchema.parse({
  pagePath: 'pages/pricing.html',
  lockId: 'footer-legal',
  rule: 'content',
  domPath: 'body/main[1]',
  ...overrides,
});

describe('splitting a dom path', () => {
  it('yields one segment per element', () => {
    expect(domPathSegments('body/main[1]/footer[3]')).toEqual(['body', 'main[1]', 'footer[3]']);
  });

  it('drops the empty segments that leading and trailing slashes would create', () => {
    expect(domPathSegments('/body/main[1]/')).toEqual(['body', 'main[1]']);
  });

  it('yields nothing for an empty path', () => {
    expect(domPathSegments('')).toEqual([]);
  });
});

describe('segment prefixes', () => {
  it('treats an equal path as a prefix of itself', () => {
    expect(isSegmentPrefix('body/main[1]/footer[3]', 'body/main[1]/footer[3]')).toBe(true);
  });

  it('accepts a proper prefix', () => {
    expect(isSegmentPrefix('body/main[1]', 'body/main[1]/footer[3]')).toBe(true);
  });

  it('rejects a label deeper than the finding', () => {
    expect(isSegmentPrefix('body/main[1]/footer[3]', 'body/main[1]')).toBe(false);
  });

  it('rejects a divergent segment', () => {
    expect(isSegmentPrefix('body/aside[1]', 'body/main[1]/footer[3]')).toBe(false);
  });

  it('compares whole segments, so div[1] is not a prefix of div[10]', () => {
    expect(isSegmentPrefix('body/div[1]', 'body/div[10]/footer[1]')).toBe(false);
  });
});

describe('matching a finding against a label', () => {
  it('matches when identity, rule, page and path all agree', () => {
    expect(findingMatchesLabel(makeFinding(), makeLabel())).toBe(true);
  });

  it('rejects a different lock', () => {
    expect(findingMatchesLabel(makeFinding({ lockId: 'hero-headline' }), makeLabel())).toBe(false);
  });

  it('rejects a different rule', () => {
    const finding = makeFinding({ rule: 'position', checker: 'relational_position_anchor' });
    expect(findingMatchesLabel(finding, makeLabel())).toBe(false);
  });

  it('rejects a different page', () => {
    expect(findingMatchesLabel(makeFinding({ pagePath: 'pages/home.html' }), makeLabel())).toBe(false);
  });

  it('rejects a path the label does not prefix', () => {
    expect(findingMatchesLabel(makeFinding(), makeLabel({ domPath: 'body/aside[1]' }))).toBe(false);
  });

  it('rejects a blank reason', () => {
    // The finding schema forbids a blank reason, so the only way to exercise the
    // guard is to damage an already parsed finding.
    const blank = { ...makeFinding(), reason: '   ' } as Finding;
    expect(findingMatchesLabel(blank, makeLabel())).toBe(false);
  });
});
