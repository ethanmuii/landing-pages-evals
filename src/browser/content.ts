import { findingSchema, type Finding } from '../findings/finding.js';
import type { LockMeasurement } from './extract.js';

function normalize(text: string): string {
  return text.replace(/\s+/gu, ' ').trim();
}

export function contentFinding(
  lockId: string,
  pagePath: string,
  domPath: string,
  baselineText: string,
  measurement: LockMeasurement,
): Finding {
  const matches = measurement.visibleText === normalize(baselineText);

  return findingSchema.parse({
    lockId,
    rule: 'content',
    pagePath,
    domPath,
    verdict: matches ? 'pass' : 'fail',
    confidence: null,
    checker: 'deterministic_content_normalizer',
    reason: matches
      ? 'Content check passed: visible text matches the baseline exactly.'
      : 'Content check failed: visible text changed.',
  });
}
