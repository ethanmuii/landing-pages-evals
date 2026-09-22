import { describe, expect, it } from 'vitest';
import { findingSchema, type Finding } from '../../src/findings/finding.js';
import type { Verdict } from '../../src/findings/verdict.js';
import { reviewLines } from '../../src/output/review.js';

function judged(lockId: string, verdict: Verdict, reason: string): Finding {
  return findingSchema.parse({
    lockId,
    rule: 'content',
    pagePath: 'a.html',
    domPath: 'main > h1',
    verdict,
    confidence: verdict === 'needs_review' ? null : 0.9,
    checker: 'deterministic_content_normalizer_llm_judge',
    reason,
  });
}

describe('a needs_review finding', () => {
  it('yields the exact surfacing line', () => {
    const finding = judged('hero', 'needs_review', 'The judge could not decide.');
    expect(reviewLines([finding])).toEqual([
      'SURFACE FOR HUMAN REVIEW: hero The judge could not decide.',
    ]);
  });

  it('copies the lockId and reason verbatim, spaces and quotes included', () => {
    const finding = judged('hero cta', 'needs_review', 'Saw "Buy now" but expected "Buy".');
    expect(reviewLines([finding])).toEqual([
      'SURFACE FOR HUMAN REVIEW: hero cta Saw "Buy now" but expected "Buy".',
    ]);
  });
});

describe('other verdicts', () => {
  it('ignores a pass finding', () => {
    expect(reviewLines([judged('hero', 'pass', 'Matched.')])).toEqual([]);
  });

  it('ignores a fail finding', () => {
    expect(reviewLines([judged('hero', 'fail', 'Drifted.')])).toEqual([]);
  });

  it('keeps only the review findings from a mixed list', () => {
    const findings = [
      judged('hero', 'pass', 'Matched.'),
      judged('cta', 'needs_review', 'Ambiguous.'),
      judged('footer', 'fail', 'Drifted.'),
    ];
    expect(reviewLines(findings)).toEqual(['SURFACE FOR HUMAN REVIEW: cta Ambiguous.']);
  });
});

describe('several review findings', () => {
  it('emits two lines for one lock, in input order', () => {
    const findings = [
      judged('hero', 'needs_review', 'First doubt.'),
      judged('hero', 'needs_review', 'Second doubt.'),
    ];
    expect(reviewLines(findings)).toEqual([
      'SURFACE FOR HUMAN REVIEW: hero First doubt.',
      'SURFACE FOR HUMAN REVIEW: hero Second doubt.',
    ]);
  });

  it('preserves the order the caller gave, not an alphabetical one', () => {
    const findings = [
      judged('zulu', 'needs_review', 'Later lock.'),
      judged('alpha', 'needs_review', 'Earlier lock.'),
    ];
    expect(reviewLines(findings)).toEqual([
      'SURFACE FOR HUMAN REVIEW: zulu Later lock.',
      'SURFACE FOR HUMAN REVIEW: alpha Earlier lock.',
    ]);
  });
});

describe('an empty list', () => {
  it('yields no lines', () => {
    expect(reviewLines([])).toEqual([]);
  });
});
