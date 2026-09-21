import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { findingSchema } from '../../src/findings/finding.js';

const content = {
  lockId: 'footer-legal',
  rule: 'content',
  pagePath: 'fixtures/page.html',
  domPath: 'html > body > footer',
  verdict: 'pass',
  confidence: null,
  reason: 'Normalized text matches.',
  checker: 'deterministic_content_normalizer',
};

describe('shared finding contract', () => {
  it.each([
    ['content', 'deterministic_content_normalizer'],
    ['appearance', 'playwright_appearance_proxy'],
    ['position', 'relational_position_anchor'],
  ])('accepts deterministic %s findings', (rule, checker) => {
    for (const verdict of ['pass', 'fail']) {
      const finding = { ...content, rule, checker, verdict };
      expect(findingSchema.parse(finding)).toEqual(finding);
    }
  });

  it.each(['content', 'appearance'])('accepts judged %s findings', (rule) => {
    const checker = rule === 'content'
      ? 'deterministic_content_normalizer_llm_judge'
      : 'playwright_appearance_proxy_llm_judge';
    for (const verdict of ['pass', 'fail', 'needs_review']) {
      const finding = { ...content, rule, checker, verdict, confidence: 0.8 };
      expect(findingSchema.parse(finding)).toEqual(finding);
    }
  });

  it('accepts an unavailable judge with null confidence', () => {
    expect(findingSchema.safeParse({ ...content,
      checker: 'deterministic_content_normalizer_llm_judge',
      verdict: 'needs_review', reason: 'Judge timed out.',
    }).success).toBe(true);
  });

  it('enforces the missing-lock precondition contract', () => {
    const missing = { ...content, rule: 'structural_ambiguity',
      checker: 'presence_precondition', domPath: 'NOT_FOUND', verdict: 'fail' };
    expect(findingSchema.parse(missing)).toEqual(missing);
    for (const change of [{ verdict: 'pass' }, { domPath: 'footer' }, { confidence: 1 }, { rule: 'content' }]) {
      expect(findingSchema.safeParse({ ...missing, ...change }).success).toBe(false);
    }
  });

  it.each(Object.keys(content))('requires %s', (key) => {
    const incomplete: Record<string, unknown> = { ...content };
    delete incomplete[key];
    expect(findingSchema.safeParse(incomplete).success).toBe(false);
  });

  it.each([
    { extra: true }, { latencyMs: 0 }, { costUsd: 0 },
    { reason: '' }, { reason: ' \t\n' }, { rule: 'appearance' },
    { confidence: 0.9 }, { verdict: 'needs_review' },
    { checker: 'relational_position_anchor_llm_judge' },
    { checker: 'deterministic_content_normalizer_anthropic_judge' },
    { checker: 'unknown' }, { lockId: '' }, { pagePath: 12 }, { domPath: ' ' },
    { checker: 'deterministic_content_normalizer_llm_judge', reason: 'First\nSecond' },
  ])('rejects invalid finding changes: %j', (change) => {
    expect(findingSchema.safeParse({ ...content, ...change }).success).toBe(false);
  });

  it('supports an explicitly extended strict debugging schema', () => {
    const debugSchema = findingSchema.safeExtend({ debug: z.strictObject({ trace: z.string() }) });
    const debugFinding = { ...content, debug: { trace: 'normalization' } };
    expect(debugSchema.parse(debugFinding)).toEqual(debugFinding);
    expect(findingSchema.safeParse(debugFinding).success).toBe(false);
    expect(debugSchema.safeParse({ ...debugFinding, arbitrary: true }).success).toBe(false);
    expect(debugSchema.safeParse({ ...content, debug: { trace: 'x', arbitrary: true } }).success).toBe(false);
    expect(debugSchema.safeParse({ ...debugFinding, confidence: 1 }).success).toBe(false);
  });
});
