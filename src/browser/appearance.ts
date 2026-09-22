import type { Baseline } from '../contracts/baseline.js';
import { computedStyleProperties } from '../contracts/computed-styles.js';
import { findingSchema, type Finding } from '../findings/finding.js';
import type { LockMeasurement } from './extract.js';

export const GEOMETRY_TOLERANCE_PX = 1;

export function appearanceFinding(
  lockId: string,
  pagePath: string,
  domPath: string,
  baseline: Baseline,
  measurement: LockMeasurement,
): Finding {
  const identity = { lockId, rule: 'appearance', pagePath, domPath } as const;
  const checker = { confidence: null, checker: 'playwright_appearance_proxy' } as const;
  const { width, height } = measurement;

  // Computed styles and dimensions describe a box, so without one there is
  // nothing for them to describe; listing property differences alongside a
  // missing box would dress up meaningless values as diagnosis.
  if (width === null || height === null) {
    return findingSchema.parse({
      ...identity,
      ...checker,
      verdict: 'fail',
      reason: 'Appearance check failed: lock has no rendered box.',
    });
  }

  // Visible text is the content rule's alone, even though the PRD files it
  // under the appearance proxy in S4.
  const differences = computedStyleProperties
    .filter((property) => (measurement.computedStyles[property] ?? '') !== baseline.computedStyles[property])
    .map((property) =>
      `${property} changed from ${baseline.computedStyles[property]} to ${measurement.computedStyles[property] ?? ''}`);

  // Sub-pixel layout noise moves a box by a fraction, so the tolerance is
  // inclusive: exactly one pixel of drift is still a match.
  if (Math.abs(width - baseline.width) > GEOMETRY_TOLERANCE_PX) {
    differences.push(`width changed from ${String(baseline.width)} to ${String(width)}`);
  }
  if (Math.abs(height - baseline.height) > GEOMETRY_TOLERANCE_PX) {
    differences.push(`height changed from ${String(baseline.height)} to ${String(height)}`);
  }

  return findingSchema.parse({
    ...identity,
    ...checker,
    verdict: differences.length === 0 ? 'pass' : 'fail',
    reason: differences.length === 0
      ? 'Appearance check passed: styles and dimensions match the baseline.'
      : `Appearance check failed: ${differences.join('; ')}.`,
  });
}
