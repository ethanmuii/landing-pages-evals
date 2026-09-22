import { afterAll, describe, expect, it } from 'vitest';
import { captureBaselines } from '../../fixtures/scripts/capture-baselines.js';
import { measureLock } from '../../src/browser/extract.js';
import { withRenderedPage } from '../../src/browser/session.js';
import { computedStyleProperties } from '../../src/contracts/computed-styles.js';
import { openSharedSession } from '../browser/shared-session.js';

const shared = await openSharedSession();
afterAll(() => shared.close());

describe('offline baseline capture', () => {
  it('captures measured text, dimensions, all 26 styles and relational markers', async () => {
    const html = '<main>Context</main><footer data-locked="modal-footer" style="width:320px;height:48px;color:rgb(1,2,3)">Legal   notice</footer>';
    const [captured] = await captureBaselines(shared.session, html);
    expect(captured?.lockId).toBe('modal-footer');
    expect(captured?.baseline).toMatchObject({
      visibleText: 'Legal notice', width: 320, height: 48,
      parentTag: 'body', previousSiblingTag: 'main', nextSiblingTag: null,
      computedStyles: { color: 'rgb(1, 2, 3)' },
    });
    expect(Object.keys(captured!.baseline.computedStyles)).toEqual([...computedStyleProperties]);
  });

  it('derives multiple exact ids without hardcoding or CSS selector interpolation', async () => {
    const captures = await captureBaselines(shared.session,
      '<header data-locked=" brand &quot;[x] ">Brand</header><footer data-locked="original-footer">Legal</footer>');
    expect(captures.map(({ lockId }) => lockId)).toEqual([' brand "[x] ', 'original-footer']);
  });

  it('waits for a hidden baseline to become visible before measuring', async () => {
    const captures = await captureBaselines(shared.session, `<footer data-locked="modal-footer" style="display:none;width:320px;height:48px">Legal</footer>
      <script>setTimeout(() => document.querySelector('footer').style.display = 'block', 300)</script>`);
    expect(captures[0]?.baseline.width).toBe(320);
    expect(captures[0]?.baseline.height).toBe(48);
  });

  it.each(['', '   '])('rejects blank source identifiers: %j', async (id) => {
    await expect(captureBaselines(shared.session, `<footer data-locked="${id}">Legal</footer>`)).rejects.toThrow();
  });

  it('rejects duplicate source identifiers', async () => {
    await expect(captureBaselines(shared.session,
      '<header data-locked="same">Brand</header><footer data-locked="same">Legal</footer>'))
      .rejects.toThrow('Expected exactly one baseline element');
  });

  it('keeps ordinary runtime measurement free of visibility waits', async () => {
    await withRenderedPage(shared.session, '<footer data-locked="modal-footer" style="display:none">Legal</footer>', async (page) => {
      const measurement = await measureLock(page, 'modal-footer');
      expect(measurement.width).toBeNull();
      expect(measurement.height).toBeNull();
    });
  }, 5_000);
});
