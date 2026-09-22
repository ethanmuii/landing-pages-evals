import { chromium, type Browser, type Page } from 'playwright';

export const BROWSER_VIEWPORT = { width: 1280, height: 720 } as const;
export const BROWSER_DEVICE_SCALE = 1;
export const BROWSER_LAUNCH_TIMEOUT_MS = 30_000;
export const BROWSER_PAGE_TIMEOUT_MS = 10_000;

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

export async function renderHtml(session: RenderSession, html: string): Promise<Page> {
  const page = await session.browser.newPage({
    viewport: { ...BROWSER_VIEWPORT },
    deviceScaleFactor: BROWSER_DEVICE_SCALE,
  });
  page.setDefaultTimeout(BROWSER_PAGE_TIMEOUT_MS);

  // Fixtures arrive through setContent, so a page that reaches out over http(s)
  // is fetching something the run cannot depend on: blocking every such request
  // keeps measurements offline, identical between baseline and validation, and
  // free of whatever a remote host happens to be serving today.
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.startsWith('data:') || url.startsWith('about:')) {
      await route.continue();
      return;
    }
    await route.abort();
  });

  await page.setContent(html, { waitUntil: 'domcontentloaded' });

  // Measurement reads one instant of a page, so motion is zeroed rather than
  // waited out; injecting after setContent puts this sheet last in the cascade.
  await page.addStyleTag({ content: MOTIONLESS_STYLESHEET });
  return page;
}

export async function withRenderedPage<T>(
  session: RenderSession,
  html: string,
  run: (page: Page) => Promise<T>,
): Promise<T> {
  const page = await renderHtml(session, html);
  try {
    return await run(page);
  } finally {
    await page.close();
  }
}
