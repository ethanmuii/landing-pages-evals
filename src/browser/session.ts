import { chromium, type Browser, type Page } from 'playwright';

export const BROWSER_VIEWPORT = { width: 1280, height: 720 } as const;
export const BROWSER_DEVICE_SCALE = 1;
export const BROWSER_LAUNCH_TIMEOUT_MS = 30_000;
export const BROWSER_PAGE_TIMEOUT_MS = 10_000;

// Offline baseline preparation loads a whole captured homepage, which is orders
// of magnitude larger than the generated pages the gate sees, so it gets its own
// budget. The gate keeps the shorter one: a generated page that takes this long
// is hung, not busy.
export const BROWSER_CAPTURE_TIMEOUT_MS = 60_000;

const MOTIONLESS_STYLESHEET = `
*, *::before, *::after {
  animation-duration: 0s !important;
  animation-delay: 0s !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0s !important;
  transition-delay: 0s !important;
}
`;

export interface RenderSession {
  browser: Browser;
}

export async function withRenderSession<T>(run: (session: RenderSession) => Promise<T>): Promise<T> {
  const browser = await chromium.launch({ timeout: BROWSER_LAUNCH_TIMEOUT_MS });
  try {
    return await run({ browser });
  } finally {
    await browser.close();
  }
}

export async function renderHtml(
  session: RenderSession,
  html: string,
  timeoutMs: number = BROWSER_PAGE_TIMEOUT_MS,
): Promise<Page> {
  const page = await session.browser.newPage({
    viewport: { ...BROWSER_VIEWPORT },
    deviceScaleFactor: BROWSER_DEVICE_SCALE,
  });
  try {
    page.setDefaultTimeout(timeoutMs);

    // Fixtures arrive through setContent. Blocking remote resources keeps
    // baseline capture and validation reproducible with inline assets.
    await page.route('**/*', async (route) => {
      const url = route.request().url();
      if (url.startsWith('data:') || url.startsWith('about:')) {
        await route.continue();
        return;
      }
      await route.abort();
    });

    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: timeoutMs });

    // Zero motion before awaiting font readiness and measuring the page.
    await page.addStyleTag({ content: MOTIONLESS_STYLESHEET });
    await page.waitForFunction(async () => {
      await document.fonts.ready;
      return true;
    }, undefined, { timeout: timeoutMs });
    return page;
  } catch (error) {
    await page.close();
    throw error;
  }
}

export async function withRenderedPage<T>(
  session: RenderSession,
  html: string,
  run: (page: Page) => Promise<T>,
  timeoutMs: number = BROWSER_PAGE_TIMEOUT_MS,
): Promise<T> {
  const page = await renderHtml(session, html, timeoutMs);
  try {
    return await run(page);
  } finally {
    await page.close();
  }
}
