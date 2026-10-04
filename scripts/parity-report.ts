// Prints structural differences between the reference and the build for every scene.
// Usage: tsx scripts/parity-report.ts [light|dark] [reduce]
import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { align, capture, diff, goTo, LEAD_TARGETS, open } from '../tests/parity/harness';

const scheme = (process.argv[2] as 'light' | 'dark') ?? 'light';
const reducedMotion = process.argv[3] === 'reduce';
const browser = await chromium.launch();
const ref = await open(browser, pathToFileURL(resolve('reference/lead-journey.html')).href, { scheme, reducedMotion });
const out = await open(browser, pathToFileURL(resolve('dist/lead-journey.html')).href, { scheme, reducedMotion });
await align(ref, out);
let total = 0;
for (const t of LEAD_TARGETS) {
  for (let s = 0; s < t.count; s++) {
    await goTo(ref, { lensKey: t.key, steps: s });
    await goTo(out, { lensKey: t.key, steps: s });
    const d = diff(await capture(ref), await capture(out));
    total += d.length;
    console.log(`${t.lens}[${s}]: ${d.length} differences`);
    for (const line of d.slice(0, 12)) console.log('   ' + line);
  }
}
console.log(`total ${total}`);
await browser.close();
