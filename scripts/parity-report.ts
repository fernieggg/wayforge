// Builds dataset #1 and prints structural differences from the reference, scene by scene.
// Needs the private data repo (see tests/private.ts).
// Usage: tsx scripts/parity-report.ts [light|dark] [reduce]
import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildFile } from '../src/cli/build';
import { LEAD_JOURNEY, REFERENCE } from '../tests/private';
import { align, capture, diff, goTo, LEAD_TARGETS, open } from '../tests/parity/harness';

const scheme = (process.argv[2] as 'light' | 'dark') ?? 'light';
const reducedMotion = process.argv[3] === 'reduce';
const browser = await chromium.launch();
const html = await buildFile(LEAD_JOURNEY);
if (html === null) process.exit(1);
const built = join(tmpdir(), `wayforge-parity-${process.pid}.html`);
writeFileSync(built, html);
const ref = await open(browser, pathToFileURL(REFERENCE).href, { scheme, reducedMotion });
const out = await open(browser, pathToFileURL(built).href, { scheme, reducedMotion });
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
