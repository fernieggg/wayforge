// Builds the regression journey and prints structural differences from its reference page, scene by scene.
// Needs WAYFORGE_REGRESSION_JOURNEY and WAYFORGE_REGRESSION_REFERENCE (see tests/regression/env.ts).
// Usage: tsx scripts/regression-report.ts [light|dark] [reduce]
import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildFile } from '../src/cli/build';
import { HAS_REGRESSION, REGRESSION_JOURNEY, REGRESSION_REFERENCE } from '../tests/regression/env';
import { align, capture, diff, goTo, open, targets } from '../tests/regression/harness';

if (!HAS_REGRESSION) {
  console.error('Set WAYFORGE_REGRESSION_JOURNEY and WAYFORGE_REGRESSION_REFERENCE to existing files.');
  process.exit(2);
}
const scheme = (process.argv[2] as 'light' | 'dark') ?? 'light';
const reducedMotion = process.argv[3] === 'reduce';
const browser = await chromium.launch();
const html = await buildFile(REGRESSION_JOURNEY!);
if (html === null) process.exit(1);
const built = join(tmpdir(), `wayforge-regression-${process.pid}.html`);
writeFileSync(built, html);
const ref = await open(browser, pathToFileURL(REGRESSION_REFERENCE!).href, { scheme, reducedMotion });
const out = await open(browser, pathToFileURL(built).href, { scheme, reducedMotion });
await align(ref, out);
let total = 0;
for (const t of targets(REGRESSION_JOURNEY!)) {
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
