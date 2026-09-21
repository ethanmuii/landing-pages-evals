import { describe, expect, it } from 'vitest';
import { verdictSchema } from '../../src/findings/verdict.js';

describe('verdict contract', () => {
  it.each(['pass', 'fail', 'needs_review'])('accepts %s', (verdict) => {
    expect(verdictSchema.parse(verdict)).toBe(verdict);
  });

  it.each([true, false, null, undefined, '', 'needs review', 'unknown'])(
    'rejects an unsupported verdict: %s',
    (verdict) => {
      expect(verdictSchema.safeParse(verdict).success).toBe(false);
    },
  );
});
