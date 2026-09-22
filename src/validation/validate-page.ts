import { measureLock } from '../browser/extract.js';
import { withRenderedPage, type RenderSession } from '../browser/session.js';
import type { LoadedContract } from '../contracts/load.js';
import type { Finding } from '../findings/finding.js';
import { parsePage } from '../locks/locate.js';
import { prepareLock, type PreparedLock } from './prepare-lock.js';
import { findingsForPreparedLock } from './validate-lock.js';

export async function validatePage(
  session: RenderSession,
  contract: LoadedContract,
  pagePath: string,
  html: string,
): Promise<Finding[]> {
  const document = parsePage(html);
  const prepared: PreparedLock[] = [];
  for (const lock of contract.locks) {
    prepared.push(await prepareLock(document, contract, pagePath, lock.lockId));
  }

  // Presence is a precondition per lock. If no lock survived it, no browser
  // comparison is needed and no page is opened.
  if (prepared.every((item) => item.status === 'unresolved')) {
    return prepared.flatMap((item) => item.status === 'unresolved' ? [item.finding] : []);
  }

  return withRenderedPage(session, html, async (page) => {
    const findings: Finding[] = [];
    for (const item of prepared) {
      findings.push(...await findingsForPreparedLock(item, (lockId) => measureLock(page, lockId)));
    }
    return findings;
  });
}
