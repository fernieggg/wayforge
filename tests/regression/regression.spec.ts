import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildFile } from '../../src/cli/build';
import { HAS_REGRESSION, REGRESSION_JOURNEY, REGRESSION_REFERENCE } from './env';
import { align, capture, captureTransitions, diff, goTo, open, pixelDiff, targets, type LensTarget } from './harness';

const ROOT = resolve(import.meta.dirname, '../..');
const ARTIFACTS = resolve(ROOT, 'test-results/regression');
const BUILT = resolve(ARTIFACTS, `build-${process.pid}.html`);
// Font rendering differs by a few anti-aliased pixels at most; anything more is a real difference.
const MAX_DIFF_RATIO = 0.0005;

test.skip(!HAS_REGRESSION, 'set WAYFORGE_REGRESSION_JOURNEY and WAYFORGE_REGRESSION_REFERENCE to run the visual regression suite');

const JOURNEY = REGRESSION_JOURNEY!;
const REFERENCE = REGRESSION_REFERENCE!;
let TARGETS: LensTarget[] = [];

test.beforeAll(async () => {
  TARGETS = targets(JOURNEY);
  const html = await buildFile(JOURNEY);
  if (html === null) throw new Error(`${JOURNEY} failed validation`);
  mkdirSync(ARTIFACTS, { recursive: true });
  writeFileSync(BUILT, html);
});

const url = (file: string) => pathToFileURL(file).href;

for (const scheme of ['light', 'dark'] as const) {
  for (const reducedMotion of [false, true]) {
    const mode = `${scheme}${reducedMotion ? ', reduced motion' : ''}`;
    test(`every scene matches the reference (${mode})`, async ({ browser }) => {
      const ref = await open(browser, url(REFERENCE), { scheme, reducedMotion });
      const out = await open(browser, url(BUILT), { scheme, reducedMotion });
      await align(ref, out);
      const failures: string[] = [];
      for (const t of TARGETS) {
        for (let s = 0; s < t.count; s++) {
          await goTo(ref, { lensKey: t.key, steps: s });
          await goTo(out, { lensKey: t.key, steps: s });
          const name = `${t.lens}-${s}-${scheme}${reducedMotion ? '-reduced' : ''}`;
          const d = diff(await capture(ref), await capture(out));
          if (d.length) failures.push(`${name}: ${d.length} structural differences\n  ${d.slice(0, 8).join('\n  ')}`);
          const [a, b] = [await ref.screenshot(), await out.screenshot()];
          const px = await pixelDiff(out, a, b);
          if (px.differing < 0 || px.differing / px.total > MAX_DIFF_RATIO) {
            writeFileSync(resolve(ARTIFACTS, `${name}-reference.png`), a);
            writeFileSync(resolve(ARTIFACTS, `${name}-build.png`), b);
            failures.push(`${name}: ${px.differing} of ${px.total} pixels differ`);
          }
        }
      }
      expect(failures, failures.join('\n')).toEqual([]);
    });
  }
}

test('each lens shows one step dot per scene', async ({ browser }) => {
  const out = await open(browser, url(BUILT), { scheme: 'light' });
  for (const t of TARGETS) {
    await goTo(out, { lensKey: t.key, steps: 0 });
    expect(await out.locator('.dot').count(), t.lens).toBe(t.count);
  }
});

test('declared transitions match the reference', async ({ browser }) => {
  const set = async (p: Page) => [...new Set(await captureTransitions(p))].sort();
  const ref = await open(browser, url(REFERENCE), { scheme: 'light', keepTransitions: true });
  const out = await open(browser, url(BUILT), { scheme: 'light', keepTransitions: true });
  expect(await set(out)).toEqual(await set(ref));
});
