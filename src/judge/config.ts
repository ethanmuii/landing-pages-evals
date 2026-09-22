export const DEFAULT_JUDGE_MODEL = 'claude-sonnet-5';
export const DEFAULT_JUDGE_MAX_TOKENS = 16000;
export const MAX_JUDGE_MAX_TOKENS = 64000;
export const JUDGE_CONFIDENCE_THRESHOLD = 0.8;
export const JUDGE_TIMEOUT_MS = 30_000;
export const JUDGE_MAX_RETRIES = 2;

// Hand-maintained on purpose: adopting a newly released model means adding its
// id here, and a multi-provider abstraction is deferred until one is needed.
export const SUPPORTED_JUDGE_MODELS = [
  'claude-fable-5-1',
  'claude-fable-5',
  'claude-opus-5',
  'claude-opus-4-8',
  'claude-opus-4-7',
  'claude-opus-4-6',
  'claude-sonnet-5',
  'claude-sonnet-4-6',
  'claude-haiku-4-5',
] as const;

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
    model: isBlank(model) ? DEFAULT_JUDGE_MODEL : parseModel(model),
    maxTokens: isBlank(maxTokens) ? DEFAULT_JUDGE_MAX_TOKENS : parseMaxTokens(maxTokens),
  };
}

function parseModel(value: string): string {
  const trimmed = value.trim();
  if (!(SUPPORTED_JUDGE_MODELS as readonly string[]).includes(trimmed)) {
    throw new Error(`${MODEL_VARIABLE} must name a supported model, received ${JSON.stringify(value)}`);
  }
  return trimmed;
}

function parseMaxTokens(value: string): number {
  const trimmed = value.trim();
  if (!/^\d+$/u.test(trimmed) || Number(trimmed) <= 0) {
    throw new Error(`${MAX_TOKENS_VARIABLE} must be a positive integer, received ${JSON.stringify(value)}`);
  }
  const parsed = Number(trimmed);
  if (parsed > MAX_JUDGE_MAX_TOKENS) {
    throw new Error(`${MAX_TOKENS_VARIABLE} must not exceed ${MAX_JUDGE_MAX_TOKENS}, received ${JSON.stringify(value)}`);
  }
  return parsed;
}
