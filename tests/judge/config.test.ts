import { describe, expect, it } from 'vitest';
import {
  DEFAULT_JUDGE_MAX_TOKENS,
  DEFAULT_JUDGE_MODEL,
  JUDGE_CONFIDENCE_THRESHOLD,
  JUDGE_MAX_RETRIES,
  JUDGE_TIMEOUT_MS,
  resolveJudgeConfig,
} from '../../src/judge/config.js';

describe('decided constants', () => {
  it('exports the agreed defaults', () => {
    expect(DEFAULT_JUDGE_MODEL).toBe('claude-sonnet-5');
    expect(DEFAULT_JUDGE_MAX_TOKENS).toBe(16000);
    expect(JUDGE_CONFIDENCE_THRESHOLD).toBe(0.8);
    expect(JUDGE_TIMEOUT_MS).toBe(30000);
    expect(JUDGE_MAX_RETRIES).toBe(2);
  });
});

describe('model resolution', () => {
  it('falls back to the default when the variable is unset', () => {
    expect(resolveJudgeConfig({})).toEqual({ model: DEFAULT_JUDGE_MODEL, maxTokens: DEFAULT_JUDGE_MAX_TOKENS });
  });

  it.each(['', '   '])('falls back to the default for blank value %j', (value) => {
    expect(resolveJudgeConfig({ STRUCTURAL_JUDGE_MODEL: value }).model).toBe(DEFAULT_JUDGE_MODEL);
  });

  it.each(['claude-opus-5', 'my-model'])('uses %j verbatim without validating model ids', (model) => {
    expect(resolveJudgeConfig({ STRUCTURAL_JUDGE_MODEL: model }).model).toBe(model);
  });
});

describe('max tokens resolution', () => {
  it('falls back to the default when the variable is unset', () => {
    expect(resolveJudgeConfig({}).maxTokens).toBe(DEFAULT_JUDGE_MAX_TOKENS);
  });

  it.each(['', '   '])('falls back to the default for blank value %j', (value) => {
    expect(resolveJudgeConfig({ STRUCTURAL_JUDGE_MAX_TOKENS: value }).maxTokens).toBe(DEFAULT_JUDGE_MAX_TOKENS);
  });

  it('parses a positive integer string', () => {
    expect(resolveJudgeConfig({ STRUCTURAL_JUDGE_MAX_TOKENS: '4096' }).maxTokens).toBe(4096);
  });

  it.each(['abc', '-1', '0', '1.5'])('throws naming the variable for %j', (value) => {
    expect(() => resolveJudgeConfig({ STRUCTURAL_JUDGE_MAX_TOKENS: value })).toThrow(/STRUCTURAL_JUDGE_MAX_TOKENS/);
  });
});
