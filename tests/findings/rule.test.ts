import { describe, expect, it } from 'vitest';
import { ruleSchema } from '../../src/findings/rule.js';

describe('rule contract', () => {
  it.each(['content', 'appearance', 'position', 'structural_ambiguity'])(
    'accepts the specified rule: %s',
    (rule) => {
      expect(ruleSchema.parse(rule)).toBe(rule);
    },
  );

  it.each(['presence_precondition', 'structural ambiguity', 'Content', '', 'unknown', null, undefined, true, 0])(
    'rejects an unsupported rule: %s',
    (rule) => {
      expect(ruleSchema.safeParse(rule).success).toBe(false);
    },
  );
});
