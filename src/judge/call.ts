import Anthropic from '@anthropic-ai/sdk';
import type { MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages';
import { JUDGE_MAX_RETRIES, JUDGE_TIMEOUT_MS, resolveJudgeConfig, type JudgeConfig } from './config.js';
import { interpretJudgeOutput, type JudgeOutcome } from './outcome.js';
import { buildStructuralJudgeRequest, type StructuralJudgeInput } from './request.js';

export type JudgeCall = (
  request: MessageCreateParamsNonStreaming,
  options: { timeout: number; maxRetries: number },
) => Promise<unknown>;

export async function callStructuralJudge(
  input: StructuralJudgeInput,
  call: JudgeCall,
  config: JudgeConfig = resolveJudgeConfig(),
): Promise<JudgeOutcome> {
  const request = buildStructuralJudgeRequest(input, config);

  try {
    // There is no retry loop here on purpose: the timeout and retry budget are
    // handed to the SDK client, which retries 408/409/429/5xx and connection
    // failures internally before it ever throws.
    const result = await call(request, { timeout: JUDGE_TIMEOUT_MS, maxRetries: JUDGE_MAX_RETRIES });
    return interpretJudgeOutput(result);
  } catch (error) {
    // Bad credentials are deployment configuration, not lock ambiguity: routing
    // them to review would silently send an entire run to a human, so they
    // surface. Every other failure degrades to review.
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      throw error;
    }
    return { status: 'needs_review', reason: transportReason(error) };
  }
}

function transportReason(error: unknown): string {
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return 'Structural judge timed out.';
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return 'Structural judge could not be reached.';
  }
  if (error instanceof Anthropic.RateLimitError) {
    return 'Structural judge was rate limited.';
  }
  if (error instanceof Anthropic.APIError) {
    return `Structural judge failed with status ${error.status}.`;
  }
  return 'Structural judge failed unexpectedly.';
}
