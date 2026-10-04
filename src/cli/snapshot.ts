import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { loadTree } from '../model/tree';
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
  const result = loadTree(file);
  if (!report(file, result, false) || !result.flows) return 1;
  const flows = result.flows;
  const r = flows[0]!.resolved;

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
  writeFileSync(page, buildHtml(flows, await runtimeBundle()));

  let chromium: typeof import('@playwright/test').chromium;
  try {
    ({ chromium } = await import('@playwright/test'));
  } catch {
    process.stderr.write('error: wayforge snapshot needs Playwright (npm install -D @playwright/test && npx playwright install chromium)\n');
    return 1;
  }
  const browser = await chromium.launch();
  let count = 0;
  const pad = (n: number) => String(n).padStart(2, '0');
  const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  // Where the presentation is: breadcrumb path (empty at the root), lens, step, and whether Next can go on.
  const where = (p: import('@playwright/test').Page) =>
    p.evaluate(() => {
      const crumbs = document.querySelector('.crumbs')!;
      const path = crumbs.hasAttribute('hidden') ? [] : Array.from(crumbs.children).filter((c) => !c.classList.contains('sep')).map((c) => c.textContent ?? '');
      const dots = Array.from(document.querySelectorAll('.dot'));
      return {
        path,
        lens: document.querySelector('.lens-btn[aria-pressed="true"]')?.getAttribute('data-lens') ?? '',
        step: dots.findIndex((d) => d.getAttribute('aria-current') === 'true'),
        end: (document.querySelector('#next') as HTMLButtonElement).disabled,
      };
    });
  const sceneKey = (path: string[], lens: string, step: number) => {
    const flow = path.length ? flows.find((fl) => fl.label === path[path.length - 1] && fl.resolved.scenes[lens]) : flows[0];
    return flow?.resolved.scenes[lens]?.[step]?.key ?? String(step + 1);
  };
  const ZOOM_SETTLE = 2600;

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
        let seq = 0;
        const visited = new Set<string>();
        const shoot = async () => {
          const at = await where(p);
          const inside = at.path.slice(1).map(slug).join('--');
          const name = inside
            ? `${lensId}-${pad(++seq)}--${inside}-${at.lens}-${pad(at.step + 1)}-${sceneKey(at.path, at.lens, at.step)}-${scheme}.png`
            : `${lensId}-${pad(++seq)}-${sceneKey(at.path, at.lens, at.step)}-${scheme}.png`;
          await p.screenshot({ path: join(outDir, name) });
          visited.add(at.path.join(' > '));
          count++;
          return at;
        };

        // The tour: Next all the way, zooming into sub-flows where scenes say so.
        await goToScene(p, lensKey, 0, 'dots');
        for (let guard = 0; guard < 500; guard++) {
          const at = await shoot();
          if (at.end) break;
          await p.keyboard.press('ArrowRight');
          await p.clock.runFor(ZOOM_SETTLE);
        }

        // Sub-flows the tour never enters: open each by clicking, then step through until it closes.
        const owners = await p.evaluate(
          (lens) =>
            Array.from(document.querySelectorAll('[data-flow="0"] .zoomable'))
              .filter((el) => (el.getAttribute('data-lenses') ?? '').split(' ').includes(lens))
              .map((el) => ({ id: el.id, label: (el.getAttribute('aria-label') ?? '') })),
          lensId,
        );
        for (const owner of owners) {
          const child = flows[Number(await p.getAttribute(`#${owner.id}`, 'data-zoom'))];
          if (!child || visited.has([flows[0]!.label, child.label].join(' > '))) continue;
          await goToScene(p, lensKey, 0, 'dots');
          await p.locator(`#${owner.id}`).dispatchEvent('click');
          await p.clock.runFor(ZOOM_SETTLE);
          for (let guard = 0; guard < 500; guard++) {
            const at = await shoot();
            if (at.path.length === 0) break;
            await p.keyboard.press('ArrowRight');
            await p.clock.runFor(ZOOM_SETTLE);
            if ((await where(p)).path.length === 0) break;
          }
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
