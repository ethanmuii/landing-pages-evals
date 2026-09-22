import { JUDGE_CONFIDENCE_THRESHOLD } from './config.js';
import { judgeOutputSchema } from './verdict.js';

export type JudgeOutcome =
  | { status: 'decided'; verdict: 'pass' | 'fail'; confidence: number; reason: string }
  | { status: 'needs_review'; reason: string };

const MALFORMED_OUTPUT_REASON = 'Structural judge returned malformed output.';

export function interpretJudgeOutput(raw: unknown): JudgeOutcome {
  // Validation is repeated locally because the wire schema sent to the API
  // cannot express the nonblank, single-line constraints on the reason.
  const parsed = judgeOutputSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: 'needs_review', reason: MALFORMED_OUTPUT_REASON };
  }

  const { verdict, confidence, reason } = parsed.data;
  if (confidence < JUDGE_CONFIDENCE_THRESHOLD) {
    return { status: 'needs_review', reason };
  }

  return { status: 'decided', verdict, confidence, reason };
}
