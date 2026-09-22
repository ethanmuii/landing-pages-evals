import { describe, expect, it } from 'vitest';
import { baselineSchema } from '../../src/contracts/baseline.js';
import { createBaseline } from '../fixtures/baseline.js';

describe('frozen baseline observations', () => {
  it('preserves dimensions, per-lock styles, and relational markers without rendering', () => {
    const baseline = createBaseline();
    expect(baselineSchema.parse(baseline)).toEqual(baseline);
  });

  it.each(['visibleText', 'width', 'height', 'computedStyles', 'parentTag', 'previousSiblingTag', 'nextSiblingTag'])(
    'requires explicit %s', (field) => {
      const incomplete: Record<string, unknown> = createBaseline();
      delete incomplete[field];
      expect(baselineSchema.safeParse(incomplete).success).toBe(false);
    },
  );

  it.each(['width', 'height'])('requires finite numeric %s without coercion', (field) => {
    for (const value of ['1280', null, NaN, Infinity, -Infinity]) {
      expect(baselineSchema.safeParse({ ...createBaseline(), [field]: value }).success).toBe(false);
    }
  });

  it.each(['html', 'x', 'y', 'designTokens'])('rejects unspecified baseline field %s', (field) => {
    expect(baselineSchema.safeParse({ ...createBaseline(), [field]: 'extra' }).success).toBe(false);
  });
});
