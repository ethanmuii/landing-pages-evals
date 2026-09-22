import type { Finding } from '../findings/finding.js';

// The lines are returned rather than printed so the CLI checkpoint decides
// where they go; findings arrive already ordered by the caller.
export function reviewLines(findings: readonly Finding[]): string[] {
  return findings
    .filter((finding) => finding.verdict === 'needs_review')
    .map((finding) => `SURFACE FOR HUMAN REVIEW: ${finding.lockId} ${finding.reason}`);
}
