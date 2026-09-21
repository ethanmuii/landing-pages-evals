import { describe, expect, it } from 'vitest';
import { confidenceSchema } from '../../src/findings/confidence.js';

describe('confidence contract', () => {
  it.each([0, 0.5, 1, null])('accepts %s', (confidence) => {
    expect(confidenceSchema.parse(confidence)).toBe(confidence);
  });

  it.each([-0.001, 1.001, 100, NaN, Infinity, -Infinity, '0.5', '', true, undefined])(
    'rejects an unsupported confidence: %s',
    (confidence) => {
      expect(confidenceSchema.safeParse(confidence).success).toBe(false);
    },
  );
});
