import type { Browser, Page } from 'playwright';
import { afterAll, describe, expect, it } from 'vitest';
import {
  BROWSER_DEVICE_SCALE,
  BROWSER_VIEWPORT,
  renderHtml,
  withRenderSession,
  withRenderedPage,
} from '../../src/browser/session.js';
import { openSharedSession } from './shared-session.js';

const BROWSER_TEST_TIMEOUT_MS = 30_000;

const shared = await openSharedSession();

afterAll(async () => {
  await shared.close();
});

describe('browser lifecycle', () => {
  it('returns the callback value and disconnects the browser afterwards', async () => {
    let browser: Browser | undefined;

    const result = await withRenderSession(async (session) => {
      browser = session.browser;
      expect(session.browser.isConnected()).toBe(true);
      return { measured: 3 };
    });

    expect(result).toEqual({ measured: 3 });
    expect(browser?.isConnected()).toBe(false);
  }, BROWSER_TEST_TIMEOUT_MS);

  it('disconnects the browser when the callback throws and rethrows the error', async () => {
    let browser: Browser | undefined;

    await expect(withRenderSession(async (session) => {
      browser = session.browser;
      throw new Error('measurement exploded');
    })).rejects.toThrow('measurement exploded');

    expect(browser?.isConnected()).toBe(false);
  }, BROWSER_TEST_TIMEOUT_MS);
});

describe('page lifecycle', () => {
  it('returns the callback value and closes the page afterwards', async () => {
    let page: Page | undefined;

    const text = await withRenderedPage(shared.session, '<p>rendered</p>', async (opened) => {
      page = opened;
      expect(opened.isClosed()).toBe(false);
      return opened.evaluate(() => document.body.textContent);
    });

    expect(text).toBe('rendered');
    expect(page?.isClosed()).toBe(true);
  }, BROWSER_TEST_TIMEOUT_MS);

  it('closes the page when the callback throws and rethrows the error', async () => {
    let page: Page | undefined;

    await expect(withRenderedPage(shared.session, '<p>rendered</p>', async (opened) => {
      page = opened;
      throw new Error('extraction exploded');
    })).rejects.toThrow('extraction exploded');

    expect(page?.isClosed()).toBe(true);
  }, BROWSER_TEST_TIMEOUT_MS);
});

describe('viewport', () => {
  it('exposes the agreed viewport and device scale as constants', () => {
    expect(BROWSER_VIEWPORT).toEqual({ width: 1280, height: 720 });
    expect(BROWSER_DEVICE_SCALE).toBe(1);
  });

  it('renders at 1280x720 with a device pixel ratio of 1', async () => {
    const page = await renderHtml(shared.session, '<p>viewport</p>');
    try {
      const metrics = await page.evaluate(() => ({
        width: window.innerWidth,
        height: window.innerHeight,
        scale: window.devicePixelRatio,
      }));
      expect(metrics).toEqual({ width: 1280, height: 720, scale: 1 });
    } finally {
      await page.close();
    }
  }, BROWSER_TEST_TIMEOUT_MS);
});

describe('external network', () => {
  it('loads the page but never loads a remote image', async () => {
    const html = '<img id="remote" src="https://example.com/x.png" alt="remote"><p>body</p>';

    await withRenderedPage(shared.session, html, async (page) => {
      const state = await page.evaluate(() => {
        const image = document.querySelector<HTMLImageElement>('#remote');
        return {
          text: document.querySelector('p')?.textContent ?? null,
          naturalWidth: image?.naturalWidth ?? null,
        };
      });
      expect(state.text).toBe('body');
      expect(state.naturalWidth).toBe(0);
    });
  }, BROWSER_TEST_TIMEOUT_MS);

  it('serves a data: URL image without aborting it', async () => {
    const pixel = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    const html = `<img id="inline" src="${pixel}" alt="inline">`;

    await withRenderedPage(shared.session, html, async (page) => {
      await page.waitForFunction(() => document.querySelector<HTMLImageElement>('#inline')?.complete === true);
      const naturalWidth = await page.evaluate(
        () => document.querySelector<HTMLImageElement>('#inline')?.naturalWidth ?? null,
      );
      expect(naturalWidth).toBe(1);
    });
  }, BROWSER_TEST_TIMEOUT_MS);
});

describe('motion', () => {
  it('zeroes animation and transition timing on the page', async () => {
    const html = `
      <style>
        @keyframes drift { from { opacity: 0; } to { opacity: 1; } }
        #moving {
          animation: drift 30s linear 5s infinite;
          transition: opacity 20s ease 3s;
        }
      </style>
      <div id="moving">moving</div>
    `;

    await withRenderedPage(shared.session, html, async (page) => {
      const timing = await page.evaluate(() => {
        const element = document.querySelector('#moving');
        if (element === null) {
          throw new Error('Missing the animated element.');
        }
        const styles = window.getComputedStyle(element);
        return {
          animationDuration: styles.getPropertyValue('animation-duration'),
          animationDelay: styles.getPropertyValue('animation-delay'),
          animationIterationCount: styles.getPropertyValue('animation-iteration-count'),
          transitionDuration: styles.getPropertyValue('transition-duration'),
          transitionDelay: styles.getPropertyValue('transition-delay'),
        };
      });

      expect(timing).toEqual({
        animationDuration: '0s',
        animationDelay: '0s',
        animationIterationCount: '1',
        transitionDuration: '0s',
        transitionDelay: '0s',
      });
    });
  }, BROWSER_TEST_TIMEOUT_MS);
});
