export const DEFAULT_JUDGE_MODEL = 'claude-sonnet-5';
export const DEFAULT_JUDGE_MAX_TOKENS = 16000;
export const JUDGE_CONFIDENCE_THRESHOLD = 0.8;
export const JUDGE_TIMEOUT_MS = 30_000;
export const JUDGE_MAX_RETRIES = 2;

export interface JudgeConfig {
  model: string;
  maxTokens: number;
}

const MODEL_VARIABLE = 'STRUCTURAL_JUDGE_MODEL';
const MAX_TOKENS_VARIABLE = 'STRUCTURAL_JUDGE_MAX_TOKENS';

function isBlank(value: string | undefined): value is undefined | '' {
  return value === undefined || value.trim() === '';
}

export function resolveJudgeConfig(env: Record<string, string | undefined> = process.env): JudgeConfig {
  const model = env[MODEL_VARIABLE];
  const maxTokens = env[MAX_TOKENS_VARIABLE];

  return {
    model: isBlank(model) ? DEFAULT_JUDGE_MODEL : model,
    maxTokens: isBlank(maxTokens) ? DEFAULT_JUDGE_MAX_TOKENS : parseMaxTokens(maxTokens),
  };
}

function parseMaxTokens(value: string): number {
  const trimmed = value.trim();
  if (!/^\d+$/u.test(trimmed) || Number(trimmed) <= 0) {
    throw new Error(`${MAX_TOKENS_VARIABLE} must be a positive integer, received ${JSON.stringify(value)}`);
  }
  return Number(trimmed);
}
