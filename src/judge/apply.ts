import { findingSchema, type Finding } from '../findings/finding.js';
import type { JudgeOutcome } from './outcome.js';

type Checker = Finding['checker'];

const JUDGED_CHECKERS: Partial<Record<Checker, Checker>> = {
  deterministic_content_normalizer: 'deterministic_content_normalizer_llm_judge',
  playwright_appearance_proxy: 'playwright_appearance_proxy_llm_judge',
};

export function applyJudgeOutcome(active: Finding, outcome: JudgeOutcome): Finding {
  const checker = JUDGED_CHECKERS[active.checker];
  if (checker === undefined) {
    throw new Error(`Only content and appearance findings reach the structural judge, received ${active.checker}`);
  }

  // A deterministic failure is authoritative: the judge resolves ambiguity and
  // never overturns a check that already decided against the lock.
  if (active.verdict === 'fail') {
    return active;
  }

  const identity = {
    lockId: active.lockId,
    rule: active.rule,
    pagePath: active.pagePath,
    domPath: active.domPath,
    checker,
  };

  if (outcome.status === 'decided') {
    return findingSchema.parse({
      ...identity,
      verdict: outcome.verdict,
      confidence: outcome.confidence,
      reason: outcome.reason,
    });
  }

  return findingSchema.parse({
    ...identity,
    verdict: 'needs_review',
    confidence: null,
    reason: outcome.reason,
  });
}
