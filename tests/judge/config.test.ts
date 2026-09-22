import { describe, expect, it } from 'vitest';
import {
  DEFAULT_JUDGE_MAX_TOKENS,
  DEFAULT_JUDGE_MODEL,
  JUDGE_CONFIDENCE_THRESHOLD,
  JUDGE_MAX_RETRIES,
  JUDGE_TIMEOUT_MS,
  MAX_JUDGE_MAX_TOKENS,
  SUPPORTED_JUDGE_MODELS,
  resolveJudgeConfig,
} from '../../src/judge/config.js';

describe('decided constants', () => {
  it('exports the agreed defaults', () => {
    expect(DEFAULT_JUDGE_MODEL).toBe('claude-sonnet-5');
    expect(DEFAULT_JUDGE_MAX_TOKENS).toBe(16000);
    expect(MAX_JUDGE_MAX_TOKENS).toBe(64000);
    expect(JUDGE_CONFIDENCE_THRESHOLD).toBe(0.8);
    expect(JUDGE_TIMEOUT_MS).toBe(30000);
    expect(JUDGE_MAX_RETRIES).toBe(2);
  });

  it('exports exactly the supported model ids', () => {
    expect([...SUPPORTED_JUDGE_MODELS]).toEqual([
      'claude-fable-5-1',
      'claude-fable-5',
      'claude-opus-5',
      'claude-opus-4-8',
      'claude-opus-4-7',
      'claude-opus-4-6',
      'claude-sonnet-5',
      'claude-sonnet-4-6',
      'claude-haiku-4-5',
    ]);
  });

  it('keeps the default model inside the allowlist', () => {
    expect(SUPPORTED_JUDGE_MODELS).toContain(DEFAULT_JUDGE_MODEL);
  });
});

describe('model resolution', () => {
  it('falls back to the default when the variable is unset', () => {
    expect(resolveJudgeConfig({})).toEqual({ model: DEFAULT_JUDGE_MODEL, maxTokens: DEFAULT_JUDGE_MAX_TOKENS });
  });

  it.each(['', '   '])('falls back to the default for blank value %j', (value) => {
    expect(resolveJudgeConfig({ STRUCTURAL_JUDGE_MODEL: value }).model).toBe(DEFAULT_JUDGE_MODEL);
  });

  it.each(SUPPORTED_JUDGE_MODELS)('accepts the supported model %j verbatim', (model) => {
    expect(resolveJudgeConfig({ STRUCTURAL_JUDGE_MODEL: model }).model).toBe(model);
  });

  it('trims surrounding whitespace before matching the allowlist', () => {
    expect(resolveJudgeConfig({ STRUCTURAL_JUDGE_MODEL: '  claude-opus-5  ' }).model).toBe('claude-opus-5');
  });

  it.each(['claude-sonet-5', 'gpt-4', 'Claude-Sonnet-5', 'claude-'])(
    'throws naming the variable for unsupported model %j',
    (model) => {
      expect(() => resolveJudgeConfig({ STRUCTURAL_JUDGE_MODEL: model })).toThrow(/STRUCTURAL_JUDGE_MODEL/);
    },
  );
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

  it('accepts leading zeros', () => {
    expect(resolveJudgeConfig({ STRUCTURAL_JUDGE_MAX_TOKENS: '007' }).maxTokens).toBe(7);
  });

  it('accepts the upper bound', () => {
    expect(resolveJudgeConfig({ STRUCTURAL_JUDGE_MAX_TOKENS: '64000' }).maxTokens).toBe(MAX_JUDGE_MAX_TOKENS);
  });

  it.each(['abc', '-1', '0', '1.5', '64001'])('throws naming the variable for %j', (value) => {
    expect(() => resolveJudgeConfig({ STRUCTURAL_JUDGE_MAX_TOKENS: value })).toThrow(/STRUCTURAL_JUDGE_MAX_TOKENS/);
  });
});
