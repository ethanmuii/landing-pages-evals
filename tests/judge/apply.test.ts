import { describe, expect, it } from 'vitest';
import { findingSchema, type Finding } from '../../src/findings/finding.js';
import { applyJudgeOutcome } from '../../src/judge/apply.js';
import type { JudgeOutcome } from '../../src/judge/outcome.js';

function activeFinding(overrides: Partial<Finding> = {}): Finding {
  return findingSchema.parse({
    lockId: 'hero-headline',
    rule: 'content',
    pagePath: 'pages/index.html',
    domPath: 'body > main > section:nth-of-type(1)',
    verdict: 'pass',
    confidence: null,
    reason: 'Normalized copy matches the baseline.',
    checker: 'deterministic_content_normalizer',
    ...overrides,
  });
}

const decidedFail: JudgeOutcome = {
  status: 'decided',
  verdict: 'fail',
  confidence: 0.93,
  reason: 'The headline was reparented under an unrelated section.',
};

describe('judged content findings', () => {
  it('suffixes the checker and adopts the decided verdict', () => {
    const active = activeFinding();
    const judged = applyJudgeOutcome(active, decidedFail);

    expect(judged).toEqual({
      lockId: 'hero-headline',
      rule: 'content',
      pagePath: 'pages/index.html',
      domPath: 'body > main > section:nth-of-type(1)',
      verdict: 'fail',
      confidence: 0.93,
      reason: 'The headline was reparented under an unrelated section.',
      checker: 'deterministic_content_normalizer_llm_judge',
    });
    expect(findingSchema.safeParse(judged).success).toBe(true);
  });

  it('leaves the active finding unmutated', () => {
    const active = activeFinding();
    applyJudgeOutcome(active, decidedFail);

    expect(active.checker).toBe('deterministic_content_normalizer');
    expect(active.verdict).toBe('pass');
    expect(active.confidence).toBeNull();
    expect(active.reason).toBe('Normalized copy matches the baseline.');
  });
});

describe('judged appearance findings', () => {
  it('suffixes the appearance checker', () => {
    const active = activeFinding({
      rule: 'appearance',
      checker: 'playwright_appearance_proxy',
      reason: 'Rendered box matches the baseline within tolerance.',
    });
    const judged = applyJudgeOutcome(active, decidedFail);

    expect(judged.checker).toBe('playwright_appearance_proxy_llm_judge');
    expect(judged.rule).toBe('appearance');
    expect(judged.verdict).toBe('fail');
    expect(judged.confidence).toBe(0.93);
    expect(active.checker).toBe('playwright_appearance_proxy');
    expect(findingSchema.safeParse(judged).success).toBe(true);
  });
});

describe('deterministic failures', () => {
  it.each(['deterministic_content_normalizer', 'playwright_appearance_proxy'] as const)(
    'returns a failing %s finding untouched',
    (checker) => {
      const active = activeFinding({
        rule: checker === 'deterministic_content_normalizer' ? 'content' : 'appearance',
        checker,
        verdict: 'fail',
        reason: 'Normalized copy diverges from the baseline.',
      });
      const judged = applyJudgeOutcome(active, {
        status: 'decided',
        verdict: 'pass',
        confidence: 1,
        reason: 'Looks structurally intact.',
      });

      expect(judged).toBe(active);
      expect(judged.checker).toBe(checker);
      expect(judged.confidence).toBeNull();
      expect(findingSchema.safeParse(judged).success).toBe(true);
    },
  );
});

describe('review outcomes', () => {
  it('records needs_review with a null confidence', () => {
    const active = activeFinding();
    const judged = applyJudgeOutcome(active, {
      status: 'needs_review',
      reason: 'Structural judge returned malformed output.',
    });

    expect(judged.verdict).toBe('needs_review');
    expect(judged.confidence).toBeNull();
    expect(judged.checker).toBe('deterministic_content_normalizer_llm_judge');
    expect(judged.reason).toBe('Structural judge returned malformed output.');
    expect(findingSchema.safeParse(judged).success).toBe(true);
  });
});

describe('checkers the judge does not own', () => {
  it.each([
    { checker: 'presence_precondition', rule: 'structural_ambiguity', verdict: 'fail', domPath: 'NOT_FOUND' },
    { checker: 'relational_position_anchor', rule: 'position', verdict: 'pass', domPath: 'body > main' },
  ] as const)('throws for $checker', (overrides) => {
    const active = activeFinding(overrides);
    expect(() => applyJudgeOutcome(active, decidedFail)).toThrow(/structural judge/i);
  });
});
