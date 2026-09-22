import { describe, expect, it } from 'vitest';
import { labelSchema, type EvalLabel } from '../../src/eval/label.js';
import { evalRates, scoreFindings } from '../../src/eval/score.js';
import { findingSchema, type Finding } from '../../src/findings/finding.js';

// Pure path operations: this directory and its files need not exist.
const MOCK_PAGES_ROOT = 'pages';

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

const makeReview = (overrides: Record<string, unknown> = {}): Finding => makeFinding({
  verdict: 'needs_review',
  confidence: null,
  checker: 'deterministic_content_normalizer_llm_judge',
  ...overrides,
});

const makeLabel = (overrides: Record<string, unknown> = {}): EvalLabel => labelSchema.parse({
  pagePath: 'pricing.html',
  lockId: 'footer-legal',
  rule: 'content',
  domPath: 'body/main[1]',
  ...overrides,
});

describe('counting one page', () => {
  it('scores a fail that lands on its label as a true positive', () => {
    const finding = makeFinding();
    const label = makeLabel();
    const score = scoreFindings([finding], [label], MOCK_PAGES_ROOT);

    expect(score).toEqual({
      truePositives: 1,
      falsePositives: 0,
      falseNegatives: 0,
      mislocated: 0,
      needsReview: 0,
      matchedPairs: [{ finding, label }],
      unmatchedLabels: [],
      unmatchedFailFindings: [],
      reviewFindings: [],
    });
    expect(evalRates(score)).toEqual({ precision: 1, recall: 1, reviewRate: 0 });
  });

  it('scores a label nobody found as a false negative', () => {
    const label = makeLabel();
    const score = scoreFindings([], [label], MOCK_PAGES_ROOT);

    expect(score.falseNegatives).toBe(1);
    expect(score.unmatchedLabels).toEqual([label]);
    expect(evalRates(score)).toEqual({ precision: null, recall: 0, reviewRate: null });
  });

  it('scores a fail nobody labelled as a false positive', () => {
    const finding = makeFinding();
    const score = scoreFindings([finding], [], MOCK_PAGES_ROOT);

    expect(score.falsePositives).toBe(1);
    expect(score.unmatchedFailFindings).toEqual([finding]);
    expect(evalRates(score)).toEqual({ precision: 0, recall: null, reviewRate: 0 });
  });
});

describe('findings that do not claim a violation', () => {
  it('ignores passing findings entirely', () => {
    const failing = makeFinding();
    const findings = [
      makeFinding({ verdict: 'pass', reason: 'Normalized text matches.' }),
      failing,
      makeFinding({ verdict: 'pass', rule: 'position', checker: 'relational_position_anchor', reason: 'Anchors match.' }),
    ];
    const score = scoreFindings(findings, [makeLabel()], MOCK_PAGES_ROOT);

    expect(score.truePositives).toBe(1);
    expect(score.falsePositives).toBe(0);
    expect(score.falseNegatives).toBe(0);
    expect(score.matchedPairs.map((pair) => pair.finding)).toEqual([failing]);
  });

  it('sets needs_review aside instead of matching or counting it', () => {
    const review = makeReview();
    const failing = makeFinding();
    const score = scoreFindings([review, failing], [makeLabel()], MOCK_PAGES_ROOT);

    expect(score.truePositives).toBe(1);
    expect(score.falsePositives).toBe(0);
    expect(score.needsReview).toBe(1);
    expect(score.reviewFindings).toEqual([review]);
    expect(score.matchedPairs).toEqual([{ finding: failing, label: makeLabel() }]);
  });

  it('leaves a label unmatched when only a review finding lines up with it', () => {
    const score = scoreFindings([makeReview()], [makeLabel()], MOCK_PAGES_ROOT);

    expect(score).toMatchObject({ truePositives: 0, falsePositives: 0, falseNegatives: 1, needsReview: 1 });
    expect(evalRates(score)).toEqual({ precision: null, recall: 0, reviewRate: 1 });
  });

  it('computes a review rate against the findings that were decided', () => {
    const score = scoreFindings([makeReview(), makeFinding()], [makeLabel()], MOCK_PAGES_ROOT);
    expect(evalRates(score).reviewRate).toBe(0.5);
  });
});

describe('one-to-one pairing', () => {
  it('lets one finding satisfy only one of two identical labels', () => {
    const score = scoreFindings([makeFinding()], [makeLabel(), makeLabel()], MOCK_PAGES_ROOT);

    expect(score.truePositives).toBe(1);
    expect(score.falseNegatives).toBe(1);
    expect(score.falsePositives).toBe(0);
  });

  it('leaves the second of two matching findings as a false positive', () => {
    const first = makeFinding();
    const second = makeFinding({ domPath: 'body/main[1]/footer[4]' });
    const score = scoreFindings([first, second], [makeLabel()], MOCK_PAGES_ROOT);

    expect(score.truePositives).toBe(1);
    expect(score.falsePositives).toBe(1);
    expect(score.matchedPairs.map((pair) => pair.finding)).toEqual([first]);
    expect(score.unmatchedFailFindings).toEqual([second]);
  });
});

describe('mislocation', () => {
  it('counts a right-rule wrong-place fail as a false positive, a false negative and mislocated', () => {
    const finding = makeFinding({ domPath: 'body/aside[2]/footer[1]' });
    const score = scoreFindings([finding], [makeLabel()], MOCK_PAGES_ROOT);

    expect(score.falsePositives).toBe(1);
    expect(score.falseNegatives).toBe(1);
    expect(score.mislocated).toBe(1);
  });

  it('does not call a fail on another rule mislocated', () => {
    const finding = makeFinding({ rule: 'position', checker: 'relational_position_anchor', reason: 'Anchors moved.' });
    const score = scoreFindings([finding], [makeLabel()], MOCK_PAGES_ROOT);

    expect(score.falsePositives).toBe(1);
    expect(score.falseNegatives).toBe(1);
    expect(score.mislocated).toBe(0);
  });

  it('does not call a fail on another lock mislocated', () => {
    const score = scoreFindings([makeFinding({ lockId: 'hero-headline' })], [makeLabel()], MOCK_PAGES_ROOT);
    expect(score.mislocated).toBe(0);
  });
});

describe('rates', () => {
  it('returns null rather than NaN when nothing was scored', () => {
    expect(evalRates(scoreFindings([], [], MOCK_PAGES_ROOT))).toEqual({ precision: null, recall: null, reviewRate: null });
  });
});

describe('determinism', () => {
  it('produces an identical result for identical inputs', () => {
    const findings = [makeFinding(), makeReview(), makeFinding({ lockId: 'hero-headline' })];
    const labels = [makeLabel(), makeLabel({ lockId: 'nav-links', domPath: 'body/nav[1]' })];

    expect(scoreFindings(findings, labels, MOCK_PAGES_ROOT)).toEqual(scoreFindings(findings, labels, MOCK_PAGES_ROOT));
  });

  it('keeps matched pairs in label order', () => {
    const footer = makeFinding();
    const hero = makeFinding({ lockId: 'hero-headline', domPath: 'body/header[1]/h1[1]' });
    const heroLabel = makeLabel({ lockId: 'hero-headline', domPath: 'body/header[1]' });
    const score = scoreFindings([footer, hero], [heroLabel, makeLabel()], MOCK_PAGES_ROOT);

    expect(score.matchedPairs.map((pair) => pair.label)).toEqual([heroLabel, makeLabel()]);
  });
});

describe('scoring against the paths the CLI actually emits', () => {
  // listPages() joins the --pages directory onto each entry, so a finding says
  // src/fixtures/corpus/pages/content-01.html where its label says content-01.html.
  const cliFinding = makeFinding({ pagePath: 'src/fixtures/corpus/pages/content-01.html' });
  const corpusLabel = makeLabel({ pagePath: 'content-01.html' });

  it('pairs a CLI finding with its label once the root is supplied', () => {
    const score = scoreFindings([cliFinding], [corpusLabel], 'src/fixtures/corpus/pages');

    expect(score.truePositives).toBe(1);
    expect(score.falsePositives).toBe(0);
    expect(score.falseNegatives).toBe(0);
  });

  it('scores a perfect run as perfect rather than as a total miss', () => {
    const findings = ['content-01.html', 'content-02.html', 'content-03.html']
      .map((name) => makeFinding({ pagePath: `src/fixtures/corpus/pages/${name}` }));
    const labels = ['content-01.html', 'content-02.html', 'content-03.html']
      .map((name) => makeLabel({ pagePath: name }));

    expect(evalRates(scoreFindings(findings, labels, 'src/fixtures/corpus/pages')))
      .toEqual({ precision: 1, recall: 1, reviewRate: 0 });
  });

  it('rejects an omitted root instead of silently scoring every label as missed', () => {
    // @ts-expect-error The root is required for TypeScript callers as well.
    expect(() => scoreFindings([cliFinding], [corpusLabel])).toThrow('pagesRoot');
  });

  it.each(['', '   ', '\t', undefined, null])('rejects invalid roots even for empty inputs: %j', (root) => {
    expect(() => scoreFindings([], [], root as string)).toThrow('pagesRoot');
  });

  it('still reports mislocation against a rebased page path', () => {
    const strayed = makeFinding({
      pagePath: 'src/fixtures/corpus/pages/content-01.html',
      domPath: 'body/aside[9]/footer[1]',
    });
    const score = scoreFindings([strayed], [corpusLabel], 'src/fixtures/corpus/pages');

    expect(score.mislocated).toBe(1);
    expect(score.falsePositives).toBe(1);
    expect(score.falseNegatives).toBe(1);
  });

  it('keeps two pages distinct under the same root', () => {
    const findings = [
      makeFinding({ pagePath: 'src/fixtures/corpus/pages/content-01.html' }),
      makeFinding({ pagePath: 'src/fixtures/corpus/pages/content-02.html' }),
    ];
    const labels = [makeLabel({ pagePath: 'content-02.html' })];
    const score = scoreFindings(findings, labels, 'src/fixtures/corpus/pages');

    expect(score.truePositives).toBe(1);
    expect(score.matchedPairs[0]!.finding.pagePath).toBe('src/fixtures/corpus/pages/content-02.html');
    expect(score.falsePositives).toBe(1);
  });
});
