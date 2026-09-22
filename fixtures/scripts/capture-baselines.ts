import { measureLock } from '../../src/browser/extract.js';
import { BROWSER_PAGE_TIMEOUT_MS, withRenderedPage, type RenderSession } from '../../src/browser/session.js';
import { baselineSchema, type Baseline } from '../../src/contracts/baseline.js';
import { lockIdSchema } from '../../src/findings/identity.js';
import { extractRelationalMarkers } from '../../src/locks/anchors.js';
import { LOCK_ATTRIBUTE, locateLock, parsePage } from '../../src/locks/locate.js';

export interface CapturedBaseline {
  lockId: string;
  baseline: Baseline;
}

/** Offline preparation only: the publish gate must never wait for lock visibility. */
export async function captureBaselines(
  session: RenderSession,
  html: string,
): Promise<CapturedBaseline[]> {
  const parsed = parsePage(html);
  const targets = parsed(`[${LOCK_ATTRIBUTE}]`).toArray().map((element) => {
    const lockId = lockIdSchema.parse(parsed(element).attr(LOCK_ATTRIBUTE));
    if (locateLock(parsed, lockId).outcome !== 'found') {
      throw new Error(`Expected exactly one baseline element for lock ${JSON.stringify(lockId)}.`);
    }
    return { lockId, markers: extractRelationalMarkers(element) };
  });

  return withRenderedPage(session, html, async (page) => {
    const captures: CapturedBaseline[] = [];
    for (const { lockId, markers } of targets) {
      // Compare literal attribute values instead of interpolating ids into CSS.
      const candidates = await page.locator(`[${LOCK_ATTRIBUTE}]`).all();
      const matches = [];
      for (const candidate of candidates) {
        if (await candidate.getAttribute(LOCK_ATTRIBUTE) === lockId) matches.push(candidate);
      }
      const [target] = matches;
      if (target === undefined || matches.length !== 1) {
        throw new Error(`Expected exactly one rendered baseline element for lock ${JSON.stringify(lockId)}.`);
      }
      await target.waitFor({ state: 'visible', timeout: BROWSER_PAGE_TIMEOUT_MS });
      // Revealing an element can initiate an additional font load.
      await page.waitForFunction(async () => {
        await document.fonts.ready;
        return true;
      }, undefined, { timeout: BROWSER_PAGE_TIMEOUT_MS });
      const measurement = await measureLock(page, lockId);
      captures.push({ lockId, baseline: baselineSchema.parse({ ...measurement, ...markers }) });
    }
    return captures;
  });
}
