import type { RelationalMarkers } from '../contracts/relational-markers.js';
import { findingSchema, type Finding } from '../findings/finding.js';

const ANCHORS = [
  ['parentTag', 'parent'],
  ['previousSiblingTag', 'previous sibling'],
  ['nextSiblingTag', 'next sibling'],
] as const;

function describeAnchor(tag: string | null): string {
  return tag ?? 'nothing';
}

export function positionFinding(
  lockId: string,
  pagePath: string,
  domPath: string,
  baseline: RelationalMarkers,
  generated: RelationalMarkers,
): Finding {
  const differences = ANCHORS
    .filter(([key]) => baseline[key] !== generated[key])
    .map(([key, label]) =>
      `${label} changed from ${describeAnchor(baseline[key])} to ${describeAnchor(generated[key])}`);

  const reason = differences.length === 0
    ? `Position check passed: lock is still inside ${generated.parentTag} between ${describeAnchor(generated.previousSiblingTag)} and ${describeAnchor(generated.nextSiblingTag)}.`
    : `Position check failed: ${differences.join('; ')}.`;

  // Anchors either match or they do not, so there is no uncertainty for a judge
  // to resolve and the verdict is never needs_review.
  return findingSchema.parse({
    lockId,
    rule: 'position',
    pagePath,
    domPath,
    verdict: differences.length === 0 ? 'pass' : 'fail',
    confidence: null,
    checker: 'relational_position_anchor',
    reason,
  });
}
