import { findingSchema, type Finding } from '../findings/finding.js';

const RULE_ORDER = ['content', 'appearance', 'position', 'structural_ambiguity'] as const;

function compareCodeUnits(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  return left > right ? 1 : 0;
}

// Serializing returns a string rather than writing a file: the CLI checkpoint
// owns every side effect, which keeps the output layer testable on its own.
export function serializeFindings(findings: readonly Finding[], lockOrder: readonly string[]): string {
  const contractRank = new Map(lockOrder.map((lockId, index) => [lockId, index]));

  const ordered = findings.map((finding) => findingSchema.parse(finding)).sort((left, right) => {
    const byPage = compareCodeUnits(left.pagePath, right.pagePath);
    if (byPage !== 0) {
      return byPage;
    }

    // A lock outside the contract is still worth reporting, so an unknown id
    // sorts after every known one instead of failing the whole run.
    const leftRank = contractRank.get(left.lockId);
    const rightRank = contractRank.get(right.lockId);
    if (leftRank === undefined || rightRank === undefined) {
      if (leftRank !== rightRank) {
        return leftRank === undefined ? 1 : -1;
      }
      const byLock = compareCodeUnits(left.lockId, right.lockId);
      if (byLock !== 0) {
        return byLock;
      }
    } else if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    return RULE_ORDER.indexOf(left.rule) - RULE_ORDER.indexOf(right.rule);
  });

  const rows = ordered.map((finding) => ({
    lockId: finding.lockId,
    rule: finding.rule,
    pagePath: finding.pagePath,
    domPath: finding.domPath,
    verdict: finding.verdict,
    confidence: finding.confidence,
    reason: finding.reason,
    checker: finding.checker,
  }));

  return `${JSON.stringify(rows, null, 2)}\n`;
}
