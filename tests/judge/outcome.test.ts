import { describe, expect, it } from 'vitest';
import { interpretJudgeOutput } from '../../src/judge/outcome.js';

const MALFORMED = 'Structural judge returned malformed output.';
const valid = { verdict: 'pass', confidence: 0.9, reason: 'Structure preserved.' } as const;

describe('confident output', () => {
  it.each([1, 0.8, 0.81])('decides at confidence %d', (confidence) => {
    expect(interpretJudgeOutput({ ...valid, confidence })).toEqual({
      status: 'decided',
      verdict: 'pass',
      confidence,
      reason: 'Structure preserved.',
    });
  });

  it('passes a fail verdict through verbatim', () => {
    const raw = { verdict: 'fail', confidence: 0.95, reason: 'The nav block was reparented.' };
    expect(interpretJudgeOutput(raw)).toEqual({
      status: 'decided',
      verdict: 'fail',
      confidence: 0.95,
      reason: 'The nav block was reparented.',
    });
  });
});

describe('unconfident output', () => {
  it.each([0.79, 0.5, 0])('sends confidence %d to review with the model reason', (confidence) => {
    const raw = { verdict: 'fail', confidence, reason: 'Unsure whether the wrapper is decorative.' };
    expect(interpretJudgeOutput(raw)).toEqual({
      status: 'needs_review',
      reason: 'Unsure whether the wrapper is decorative.',
    });
  });
});

describe('malformed output', () => {
  const malformed: unknown[] = [
    null,
    undefined,
    'text',
    [],
    {},
    { confidence: 0.9, reason: 'Structure preserved.' },
    { verdict: 'pass', reason: 'Structure preserved.' },
    { verdict: 'pass', confidence: 0.9 },
    { ...valid, verdict: 'needs_review' },
    { ...valid, confidence: -0.1 },
    { ...valid, confidence: 1.1 },
    { ...valid, confidence: '0.9' },
    { ...valid, reason: '' },
    { ...valid, reason: '   ' },
    { ...valid, reason: 'line one\nline two' },
    { ...valid, extra: true },
  ];

  it.each(malformed)('reports the stable sentence for %j', (raw) => {
    expect(interpretJudgeOutput(raw)).toEqual({ status: 'needs_review', reason: MALFORMED });
  });

  it.each(malformed)('never throws for %j', (raw) => {
    expect(() => interpretJudgeOutput(raw)).not.toThrow();
  });
});
