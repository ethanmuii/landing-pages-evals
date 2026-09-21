import { describe, expect, it } from 'vitest';
import { checkerSchema } from '../../src/findings/checker.js';

describe('checker contract', () => {
  it.each([
    'presence_precondition',
    'deterministic_content_normalizer',
    'playwright_appearance_proxy',
    'relational_position_anchor',
    'deterministic_content_normalizer_llm_judge',
    'playwright_appearance_proxy_llm_judge',
  ])('accepts %s', (checker) => {
    expect(checkerSchema.parse(checker)).toBe(checker);
  });

  it.each(['unknown', 'content', 'presence_precondition_llm_judge',
    'relational_position_anchor_llm_judge', '', null, undefined, 1])(
    'rejects unsupported checker: %s',
    (checker) => {
      expect(checkerSchema.safeParse(checker).success).toBe(false);
    },
  );
});
