import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { validateFile } from '../validate';
import { buildHtml } from '../render/html';
import { runtimeBundle } from '../render/runtimeBundle';
import { report } from './validate';
import { goToScene, openPage } from './drive';

export async function runSnapshot(args: string[]): Promise<number> {
  const { positionals, values } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      lens: { type: 'string', multiple: true },
      theme: { type: 'string', multiple: true },
      out: { type: 'string', short: 'o' },
      width: { type: 'string' },
      height: { type: 'string' },
    },
  });
  const file = positionals[0];
  if (!file) {
    process.stderr.write('usage: wayforge snapshot <journey.json> [--lens id]... [--theme light|dark]... [-o dir] [--width 1440 --height 900]\n');
    return 2;
  }
  const result = validateFile(file);
  if (!report(file, result, false) || !result.resolved) return 1;
  const r = result.resolved;

  const lenses = values.lens ?? r.lenses.map((l) => l.id);
  for (const id of lenses) {
    if (!r.lenses.some((l) => l.id === id)) {
      process.stderr.write(`error: unknown lens "${id}" (journey has ${r.lenses.map((l) => l.id).join(', ')})\n`);
      return 2;
    }
  }
  const themes = values.theme ?? ['light', 'dark'];
  for (const t of themes) {
    if (t !== 'light' && t !== 'dark') {
      process.stderr.write(`error: --theme must be light or dark, not "${t}"\n`);
      return 2;
    }
  }

  const name = basename(file, extname(file));
  const outDir = resolve(values.out ?? join('snapshots', name));
  mkdirSync(outDir, { recursive: true });
  const page = join(tmpdir(), `wayforge-snapshot-${process.pid}.html`);
  writeFileSync(page, buildHtml(r, await runtimeBundle()));

  let chromium: typeof import('@playwright/test').chromium;
  try {
    ({ chromium } = await import('@playwright/test'));
  } catch {
    process.stderr.write('error: wayforge snapshot needs Playwright (npm install -D @playwright/test && npx playwright install chromium)\n');
    return 1;
  }
  const browser = await chromium.launch();
  let count = 0;
  try {
    for (const scheme of themes as ('light' | 'dark')[]) {
      const p = await openPage(browser, pathToFileURL(page).href, {
        scheme,
        width: values.width ? Number(values.width) : undefined,
        height: values.height ? Number(values.height) : undefined,
      });
      await p.evaluate(() => document.fonts.ready.then(() => undefined));
      for (const lensId of lenses) {
        const lensKey = String(r.lenses.findIndex((l) => l.id === lensId) + 1);
        const scenes = r.scenes[lensId]!;
        for (let i = 0; i < scenes.length; i++) {
          await goToScene(p, lensKey, i);
          const shot = join(outDir, `${lensId}-${String(i + 1).padStart(2, '0')}-${scenes[i]!.key}-${scheme}.png`);
          await p.screenshot({ path: shot });
          count++;
        }
      }
      await p.context().close();
    }
  } finally {
    await browser.close();
  }
  process.stderr.write(`wrote ${count} snapshots to ${outDir}\n`);
  return 0;
}
