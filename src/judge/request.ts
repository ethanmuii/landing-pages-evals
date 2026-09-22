import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages';
import type { JudgeConfig } from './config.js';
import { STRUCTURAL_JUDGE_RUBRIC } from './rubric.js';
import { judgeOutputSchema } from './verdict.js';

export interface StructuralJudgeInput {
  baselineHtml: string;
  generatedHtml: string;
}

export function buildStructuralJudgeRequest(
  input: StructuralJudgeInput,
  config: JudgeConfig,
): MessageCreateParamsNonStreaming {
  // Fragments are embedded verbatim: normalization happens upstream, and the
  // judge must see exactly what the normalizer could not explain.
  const content =
    `<baseline_subtree>\n${input.baselineHtml}\n</baseline_subtree>\n\n` +
    `<generated_subtree>\n${input.generatedHtml}\n</generated_subtree>`;

  return {
    model: config.model,
    max_tokens: config.maxTokens,
    system: STRUCTURAL_JUDGE_RUBRIC,
    messages: [{ role: 'user', content }],
    output_config: { format: zodOutputFormat(judgeOutputSchema) },
  };
}
