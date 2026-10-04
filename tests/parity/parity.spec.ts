import { expect, test, type Page } from '@playwright/test';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildFile } from '../../src/cli/build';
import { align, capture, captureTransitions, diff, goTo, LEAD_TARGETS, open, pixelDiff } from './harness';

const ROOT = resolve(import.meta.dirname, '../..');
const REFERENCE = resolve(ROOT, 'reference/lead-journey.html');
const JOURNEY = resolve(ROOT, 'journeys/lead-journey.json');
const BUILT = resolve(ROOT, `test-results/parity/lead-journey-${process.pid}.html`);
const ARTIFACTS = resolve(ROOT, 'test-results/parity');
// Font rendering differs by a few anti-aliased pixels at most; anything more is a real difference.
const MAX_DIFF_RATIO = 0.0005;

// Dataset #1 and the reference are private and may be removed before a public release.
test.skip(!existsSync(REFERENCE) || !existsSync(JOURNEY), 'dataset #1 or the reference is not present');

test.beforeAll(async () => {
  const html = await buildFile(JOURNEY);
  if (html === null) throw new Error('journeys/lead-journey.json failed validation');
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
      for (const t of LEAD_TARGETS) {
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

test('step counts are Prospect 6, Data 5, Both 8', async ({ browser }) => {
  const out = await open(browser, url(BUILT), { scheme: 'light' });
  for (const t of LEAD_TARGETS) {
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
