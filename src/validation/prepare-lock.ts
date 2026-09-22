import type { Baseline } from '../contracts/baseline.js';
import { loadLockBaseline, type LoadedContract } from '../contracts/load.js';
import type { Finding } from '../findings/finding.js';
import { domPathOf } from '../locks/dom-path.js';
import { locateLock, type PageDocument } from '../locks/locate.js';
import { presenceFinding } from '../locks/presence.js';
import { extractRelationalMarkers } from '../locks/anchors.js';
import type { RelationalMarkers } from '../contracts/relational-markers.js';

export type PreparedLock =
  | { status: 'unresolved'; finding: Finding }
  | {
    status: 'ready';
    lockId: string;
    pagePath: string;
    domPath: string;
    baseline: Baseline;
    generatedMarkers: RelationalMarkers;
  };

export async function prepareLock(
  document: PageDocument,
  contract: LoadedContract,
  pagePath: string,
  lockId: string,
): Promise<PreparedLock> {
  const location = locateLock(document, lockId);
  if (location.outcome !== 'found') {
    return { status: 'unresolved', finding: presenceFinding(location, pagePath) };
  }

  const { baseline } = await loadLockBaseline(contract, lockId);

  return {
    status: 'ready',
    lockId,
    pagePath,
    domPath: domPathOf(location.element),
    baseline,
    generatedMarkers: extractRelationalMarkers(location.element),
  };
}
