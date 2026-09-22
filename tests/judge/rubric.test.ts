import { describe, expect, it } from 'vitest';
import { STRUCTURAL_JUDGE_RUBRIC } from '../../src/judge/rubric.js';

describe('rubric content', () => {
  it.each([
    '<baseline_subtree>',
    '<generated_subtree>',
    '"verdict": "pass" | "fail"',
    'IGNORE Wording & Text Changes',
  ])('contains %j', (fragment) => {
    expect(STRUCTURAL_JUDGE_RUBRIC).toContain(fragment);
  });

  it('spells out the tolerated wrapper tags and identity attributes', () => {
    expect(STRUCTURAL_JUDGE_RUBRIC).toContain('naked `div` or `span` tags without `id`, `role`, or `aria-label` attributes');
  });
});

describe('corpus isolation', () => {
  // The prompt must know nothing about the eval corpus. Words are matched as
  // standalone tokens so the HTML attribute name `aria-label` does not count.
  it.each(['label', 'mutation', 'clean'])('does not mention %j', (word) => {
    expect(STRUCTURAL_JUDGE_RUBRIC).not.toMatch(new RegExp(`(?<![\\w-])${word}(?![\\w-])`, 'u'));
  });
});
