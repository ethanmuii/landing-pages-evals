import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RenderSession } from '../../src/browser/session.js';
import { contractSchema, type BrandContract } from '../../src/contracts/contract.js';
import { LOCK_ATTRIBUTE, parsePage } from '../../src/locks/locate.js';
import { captureBaselines } from './capture-baselines.js';
import type { ContentAndTokenStrategy } from './content-token-strategy.js';
import { BASELINE_CONTRACT_FILENAME } from './manual-file-injection-strategy.js';

export const MODAL_FRAGMENT_FILENAME = 'modal-footer.html';

/** One-time fixture preparation, deliberately outside the publish gate. */
export async function exportModalFixture(
  session: RenderSession,
  strategy: Pick<ContentAndTokenStrategy, 'readCleanPageHtml'>,
  directory: string,
): Promise<BrandContract> {
  const html = await strategy.readCleanPageHtml();
  const parsed = parsePage(html);
  const targets = parsed(`[${LOCK_ATTRIBUTE}]`);
  const target = targets.get(0);
  if (targets.length !== 1 || target?.name !== 'footer') {
    throw new Error('The Modal fixture must contain exactly one annotated lock, on the entire footer.');
  }
  const captures = await captureBaselines(session, html);
  const contract = contractSchema.parse(captures.map(({ lockId, baseline }) => ({
    lockId,
    baselinePath: MODAL_FRAGMENT_FILENAME,
    policy: { content: true, appearance: true, position: true },
    baseline,
  })));
  await writeFile(join(directory, MODAL_FRAGMENT_FILENAME), parsed.html(target), 'utf8');
  await writeFile(join(directory, BASELINE_CONTRACT_FILENAME), `${JSON.stringify(contract, null, 2)}\n`, 'utf8');
  return contract;
}
