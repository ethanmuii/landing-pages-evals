import { describe, expect, it } from 'vitest';
import { judgeOutputSchema } from '../../src/judge/verdict.js';

const valid = { verdict: 'pass', confidence: 0.8, reason: 'Structure preserved.' };

describe('accepted judge output', () => {
  it.each([0, 1, 0.8])('accepts confidence %d with a one-line reason', (confidence) => {
    const output = { ...valid, confidence };
    expect(judgeOutputSchema.parse(output)).toEqual(output);
  });

  it('accepts a fail verdict', () => {
    const output = { ...valid, verdict: 'fail' };
    expect(judgeOutputSchema.parse(output)).toEqual(output);
  });
});

describe('rejected judge output', () => {
  it.each(['needs_review', 'PASS', 'unknown', ''])('rejects verdict %j', (verdict) => {
    expect(judgeOutputSchema.safeParse({ ...valid, verdict }).success).toBe(false);
  });

  it.each([-0.1, 1.1, null, '0.5'])('rejects confidence %j', (confidence) => {
    expect(judgeOutputSchema.safeParse({ ...valid, confidence }).success).toBe(false);
  });

  it.each(['', '   '])('rejects blank reason %j', (reason) => {
    expect(judgeOutputSchema.safeParse({ ...valid, reason }).success).toBe(false);
  });

  it.each(['line one\nline two', 'line one\r\nline two', 'trailing\n'])('rejects multi-line reason %j', (reason) => {
    expect(judgeOutputSchema.safeParse({ ...valid, reason }).success).toBe(false);
  });

  it('rejects extra fields', () => {
    expect(judgeOutputSchema.safeParse({ ...valid, extra: true }).success).toBe(false);
  });

  it.each(['verdict', 'confidence', 'reason'] as const)('rejects a missing %s field', (field) => {
    const { [field]: _omitted, ...partial } = valid;
    expect(judgeOutputSchema.safeParse(partial).success).toBe(false);
  });
});
