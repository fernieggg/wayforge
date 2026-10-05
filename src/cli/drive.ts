import type { Browser, Page } from '@playwright/test';

export interface DriveOptions {
  scheme: 'light' | 'dark';
  reducedMotion?: boolean;
  width?: number;
  height?: number;
  /** Block Google Fonts so pages render with fallbacks (deterministic across machines). */
  blockFonts?: boolean;
  /** Switch CSS transitions off; they run on the real clock, not the frozen one. */
  freezeTransitions?: boolean;
}

const START = new Date('2026-01-01T00:00:00Z');

/** Opens a page with a frozen clock so frames are reproducible. */
export async function openPage(browser: Browser, url: string, o: DriveOptions): Promise<Page> {
  const ctx = await browser.newContext({
    viewport: { width: o.width ?? 1440, height: o.height ?? 900 },
    colorScheme: o.scheme,
    reducedMotion: o.reducedMotion ? 'reduce' : 'no-preference',
  });
  // tsx/esbuild wraps functions passed to page.evaluate in a __name helper.
  await ctx.addInitScript({ content: 'window.__name = (f) => f;' });
  if (o.blockFonts) await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const page = await ctx.newPage();
  await page.clock.install({ time: START });
  await page.clock.pauseAt(new Date(START.getTime() + 1000));
  await page.goto(url);
  if (o.freezeTransitions) await page.addStyleTag({ content: '*,*::before,*::after{transition-duration:0s !important;transition-delay:0s !important}' });
  // Navigation replays the clock setup with a few real milliseconds of drift; re-pausing
  // at one absolute time realigns the pages' clocks and animation frames.
  await page.clock.pauseAt(new Date(START.getTime() + 10_000));
  await page.clock.runFor(100);
  return page;
}

/**
 * Selects a lens (by its number key) and a step, then lets everything settle. `keys` steps with the
 * arrow key as a presenter would; `dots` clicks the step dot, which never zooms into a sub-flow on the way.
 */
export async function goToScene(page: Page, lensKey: string, step: number, via: 'keys' | 'dots' = 'keys') {
  await page.keyboard.press(lensKey);
  await page.clock.runFor(2000);
  if (via === 'dots') {
    await page.locator('.dot').nth(step).dispatchEvent('click');
    await page.clock.runFor(2000);
    return;
  }
  await page.keyboard.press('Home');
  await page.clock.runFor(2000);
  for (let i = 0; i < step; i++) {
    await page.keyboard.press('ArrowRight');
    await page.clock.runFor(100);
  }
  await page.clock.runFor(2000);
}
