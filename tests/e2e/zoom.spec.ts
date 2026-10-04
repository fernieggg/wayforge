import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildFile } from '../../src/cli/build';
import { goToScene, openPage } from '../../src/cli/drive';

const ROOT = resolve(import.meta.dirname, '../..');
const OUT = resolve(ROOT, 'test-results/e2e');
const PARENT = resolve(OUT, `support-ticket-${process.pid}.html`);
const CHILD = resolve(OUT, `support-queue-${process.pid}.html`);
const url = (f: string) => pathToFileURL(f).href;
const TEAM = '2';
const WORK = 3;

test.beforeAll(async () => {
  mkdirSync(OUT, { recursive: true });
  for (const [src, out] of [['support-ticket', PARENT], ['support-queue', CHILD]] as const) {
    const html = await buildFile(resolve(ROOT, `journeys/examples/${src}.json`));
    if (html === null) throw new Error(`${src} failed validation`);
    writeFileSync(out, html);
  }
});

function state(page: Page) {
  return page.evaluate(() => {
    const crumbs = document.querySelector('.crumbs')!;
    return {
      viewBox: document.querySelector('#map')!.getAttribute('viewBox')!.split(' ').map(Number),
      title: document.querySelector('#ct')!.textContent,
      crumbs: crumbs.hasAttribute('hidden') ? null : Array.from(crumbs.children).filter((c) => !c.classList.contains('sep')).map((c) => c.textContent),
      lenses: Array.from(document.querySelectorAll('.lens-btn')).map((b) => `${b.textContent}${b.getAttribute('aria-pressed') === 'true' ? '*' : ''}`),
      dots: document.querySelectorAll('.dot').length,
    };
  });
}

async function step(page: Page, key: string, ms = 2500) {
  await page.keyboard.press(key);
  await page.clock.runFor(ms);
}

test('Next on a scene with enter zooms into the sub-flow, in the matching lens', async ({ browser }) => {
  const page = await openPage(browser, url(PARENT), { scheme: 'light' });
  await goToScene(page, TEAM, WORK, 'dots');
  expect((await state(page)).title).toBe('Working the queue');
  await step(page, 'ArrowRight');
  const s = await state(page);
  expect(s.title).toBe('Every ticket starts in one inbox');
  expect(s.crumbs).toEqual(['Support flow', 'Support queue']);
  expect(s.lenses).toEqual(['Team*', 'Team lead']);
  expect(s.dots).toBe(3);
  // The camera is inside the queue container (820..1140 x 500..700).
  const [x, y, w, h] = s.viewBox as [number, number, number, number];
  expect(x).toBeGreaterThanOrEqual(820);
  expect(y).toBeGreaterThanOrEqual(500);
  expect(x + w).toBeLessThanOrEqual(1140);
  expect(y + h).toBeLessThanOrEqual(700);
});

test('Next past the last sub-flow scene zooms out and continues the parent tour', async ({ browser }) => {
  const page = await openPage(browser, url(PARENT), { scheme: 'light' });
  await goToScene(page, TEAM, WORK, 'dots');
  for (let i = 0; i < 3; i++) await step(page, 'ArrowRight');
  expect((await state(page)).title).toBe('The owner replies within the SLA');
  await step(page, 'ArrowRight');
  const s = await state(page);
  expect(s.title).toBe('Fixes become articles');
  expect(s.crumbs).toBeNull();
  expect(s.lenses).toEqual(['Customer', 'Team*']);
  expect(s.viewBox).toEqual([1080, 180, 640, 520]);
});

test('Escape, and Back on the first sub-flow scene, return to the entering scene', async ({ browser }) => {
  const page = await openPage(browser, url(PARENT), { scheme: 'light' });
  await goToScene(page, TEAM, WORK, 'dots');
  await step(page, 'ArrowRight');
  await step(page, 'ArrowRight');
  await step(page, 'Escape');
  expect((await state(page)).title).toBe('Working the queue');
  await step(page, 'ArrowRight');
  await step(page, 'ArrowLeft');
  const s = await state(page);
  expect(s.title).toBe('Working the queue');
  expect(s.viewBox).toEqual([760, 300, 820, 460]);
});

test('clicking a zoomable element opens its sub-flow in its own default lens; the breadcrumb exits', async ({ browser }) => {
  const page = await openPage(browser, url(PARENT), { scheme: 'light' });
  await goToScene(page, TEAM, 4, 'dots');
  await page.locator('#n-kb').dispatchEvent('click');
  await page.clock.runFor(2500);
  let s = await state(page);
  expect(s.title).toBe('How answers reach customers');
  expect(s.lenses).toEqual(['Authors', 'Readers*']);
  expect(s.crumbs).toEqual(['Support flow', 'Knowledge base']);
  await page.locator('.crumbs button').dispatchEvent('click');
  await page.clock.runFor(2500);
  s = await state(page);
  expect(s.title).toBe('Fixes become articles');
  expect(s.crumbs).toBeNull();
});

test('zoomable elements are reachable by keyboard', async ({ browser }) => {
  const page = await openPage(browser, url(PARENT), { scheme: 'light' });
  await goToScene(page, TEAM, 4, 'dots');
  await page.focus('#n-kb');
  await step(page, 'Enter');
  expect((await state(page)).crumbs).toEqual(['Support flow', 'Knowledge base']);
  expect(await page.getAttribute('#n-kb', 'aria-label')).toBe('Open Knowledge base');
});

test('with reduced motion, zooming swaps instantly', async ({ browser }) => {
  const page = await openPage(browser, url(PARENT), { scheme: 'light', reducedMotion: true });
  await goToScene(page, TEAM, WORK, 'dots');
  await step(page, 'ArrowRight', 200);
  const s = await state(page);
  expect(s.title).toBe('Every ticket starts in one inbox');
  const opacity = await page.evaluate(() => [0, 1].map((i) => getComputedStyle(document.querySelector(`[data-flow="${i}"]`)!).opacity));
  expect(opacity).toEqual(['0', '1']);
});

test('a sub-flow looks the same inside its parent as on its own', async ({ browser }) => {
  const looks = (page: Page, prefix: string) =>
    page.evaluate((p) => {
      const out: Record<string, string> = {};
      document.querySelectorAll(`[id^="${p}n-"]`).forEach((n) => {
        const shape = n.querySelector('rect, circle, polygon')!;
        const cs = getComputedStyle(shape);
        const id = n.id.slice(p.length);
        out[id] = [getComputedStyle(n).opacity, cs.fill, cs.stroke, cs.strokeWidth].join(' ');
      });
      return out;
    }, prefix);
  const parent = await openPage(browser, url(PARENT), { scheme: 'dark', freezeTransitions: true });
  await goToScene(parent, TEAM, WORK, 'dots');
  await step(parent, 'ArrowRight');
  await step(parent, 'ArrowRight');
  const alone = await openPage(browser, url(CHILD), { scheme: 'dark', freezeTransitions: true });
  await goToScene(alone, '1', 1, 'dots');
  expect(await looks(parent, 'z1-')).toEqual(await looks(alone, ''));
});
