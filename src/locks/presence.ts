import { findingSchema, type Finding } from '../findings/finding.js';
import type { LockLocation } from './locate.js';

export type UnresolvedLockLocation = Exclude<LockLocation, { outcome: 'found' }>;

export function presenceFinding(location: UnresolvedLockLocation, pagePath: string): Finding {
  const { lockId } = location;
  const reason = location.outcome === 'absent'
    ? `Presence check failed: Element carrying data-locked="${lockId}" is entirely missing from the markup.`
    : `Presence check failed: Found ${location.matchCount} duplicate instances of data-locked="${lockId}". Elements must be unique per page.`;

  // Parsing here makes an impossible presence finding throw at construction
  // rather than later at envelope serialization.
  return findingSchema.parse({
    lockId,
    rule: 'structural_ambiguity',
    pagePath,
    domPath: 'NOT_FOUND',
    verdict: 'fail',
    confidence: null,
    checker: 'presence_precondition',
    reason,
  });
}
