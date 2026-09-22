import { appearanceFinding } from '../browser/appearance.js';
import { contentFinding } from '../browser/content.js';
import type { LockMeasurement } from '../browser/extract.js';
import type { LoadedContract } from '../contracts/load.js';
import type { Finding } from '../findings/finding.js';
import { positionFinding } from '../locks/position.js';
import type { PageDocument } from '../locks/locate.js';
import { prepareLock, type PreparedLock } from './prepare-lock.js';

export type MeasureLock = (lockId: string) => Promise<LockMeasurement>;

export async function validateLock(
  document: PageDocument,
  contract: LoadedContract,
  pagePath: string,
  lockId: string,
  measure: MeasureLock,
): Promise<Finding[]> {
  const prepared = await prepareLock(document, contract, pagePath, lockId);
  return findingsForPreparedLock(prepared, measure);
}

export async function findingsForPreparedLock(
  prepared: PreparedLock,
  measure: MeasureLock,
): Promise<Finding[]> {
  if (prepared.status === 'unresolved') {
    return [prepared.finding];
  }

  const { lockId, pagePath, domPath, baseline, generatedMarkers } = prepared;
  const measurement = await measure(lockId);
  return [
    contentFinding(lockId, pagePath, domPath, baseline.visibleText, measurement),
    appearanceFinding(lockId, pagePath, domPath, baseline, measurement),
    positionFinding(lockId, pagePath, domPath, baseline, generatedMarkers),
  ];
}
