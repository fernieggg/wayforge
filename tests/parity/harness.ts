import type { Browser, Page } from '@playwright/test';
import { goToScene, openPage } from '../../src/cli/drive';

export interface Target {
  lensKey: string;
  steps: number;
}

export interface Options {
  scheme: 'light' | 'dark';
  reducedMotion?: boolean;
  width?: number;
  height?: number;
  /** Keep CSS transitions running (to compare their declared values). */
  keepTransitions?: boolean;
}

/** Fonts blocked and transitions frozen, so two pages driven the same way render identical frames. */
export function open(browser: Browser, url: string, o: Options): Promise<Page> {
  return openPage(browser, url, { ...o, blockFonts: true, freezeTransitions: !o.keepTransitions });
}

export function goTo(page: Page, t: Target) {
  return goToScene(page, t.lensKey, t.steps);
}

/** A comparable description of everything visible: camera, caption, nav, and every map element's computed look. */
export function capture(page: Page) {
  return page.evaluate(() => {
    const r = (n: number) => Math.round(n * 100) / 100;
    const svg = document.querySelector('#map') as SVGSVGElement;
    const style = (el: Element) => {
      const cs = getComputedStyle(el);
      return {
        opacity: r(Number(cs.opacity)),
        fill: cs.fill,
        fillOpacity: cs.fillOpacity,
        stroke: cs.stroke,
        strokeWidth: cs.strokeWidth,
        dash: cs.strokeDasharray,
        font: `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily.split(',')[0]}`,
        transform: cs.transform,
        pointerEvents: cs.pointerEvents,
        visibility: cs.visibility,
      };
    };
    const geometry = (el: Element) => {
      const out: Record<string, string> = {};
      for (const a of ['x', 'y', 'width', 'height', 'rx', 'cx', 'cy', 'r', 'points', 'd', 'text-anchor', 'filter'])
        if (el.hasAttribute(a)) out[a] = String(Number.isNaN(Number(el.getAttribute(a))) ? el.getAttribute(a) : r(Number(el.getAttribute(a))));
      return out;
    };
    // Effective opacity of an element: product over its ancestors inside the map.
    const effective = (el: Element) => {
      let o = 1;
      for (let e: Element | null = el; e && e !== svg; e = e.parentElement) o *= Number(getComputedStyle(e).opacity);
      return r(o);
    };
    const items: Record<string, unknown> = {};
    const leafs = (root: Element) =>
      Array.from(root.querySelectorAll('rect, circle, polygon, text, path')).map((el) => ({
        tag: el.tagName,
        text: el.tagName === 'text' ? el.textContent : undefined,
        ...geometry(el),
        ...style(el),
        effective: effective(el),
      }));
    svg.querySelectorAll('#nodes > g').forEach((g) => (items[g.id] = { ...style(g), leafs: leafs(g) }));
    svg.querySelectorAll('#edges > path').forEach((p) => (items[p.id] = { ...geometry(p), ...style(p) }));
    svg.querySelectorAll('#labels > text').forEach((t) => (items[`label:${t.getAttribute('data-edge')}:${t.textContent}`] = { ...geometry(t), ...style(t) }));
    svg.querySelectorAll('#decor > g').forEach((g, i) => (items[`panel:${i}`] = { ...style(g), leafs: leafs(g) }));
    const packets = Array.from(svg.querySelectorAll('#packets circle')).map((c) => ({
      ...geometry(c),
      opacity: r(Number((c as SVGElement).style.opacity || 1)),
      cls: c.getAttribute('class'),
    }));
    const dots = Array.from(document.querySelectorAll('.dot'));
    return {
      now: performance.now(),
      viewBox: svg.getAttribute('viewBox')!.split(/\s+/).map((n) => r(Number(n))).join(' '),
      title: document.querySelector('#ct')!.textContent,
      caption: document.querySelector('#cx')!.textContent,
      dots: dots.map((d) => [d.getAttribute('aria-label'), d.getAttribute('title'), d.getAttribute('aria-current')]),
      prev: (document.querySelector('#prev') as HTMLButtonElement).disabled,
      next: (document.querySelector('#next') as HTMLButtonElement).disabled,
      lens: Array.from(document.querySelectorAll('.lens-btn')).map((b) => [b.textContent, b.getAttribute('aria-pressed')]),
      packets,
      items,
    };
  });
}

/** Lists differences between two captures as readable lines. */
export function diff(a: unknown, b: unknown, path = ''): string[] {
  if (Object.is(a, b)) return [];
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return [`${path || '(root)'}: reference ${JSON.stringify(a)} vs build ${JSON.stringify(b)}`];
  const out: string[] = [];
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) out.push(...diff((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], path ? `${path}.${k}` : k));
  return out;
}

/** The lens keys and step counts of dataset #1 (Prospect 6, Data 5, Both 8). */
export const LEAD_TARGETS: { lens: string; key: string; count: number }[] = [
  { lens: 'prospect', key: '1', count: 6 },
  { lens: 'data', key: '2', count: 5 },
  { lens: 'both', key: '3', count: 8 },
];

/** Declared transitions of every element on the page, in document order. */
export function captureTransitions(page: Page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('body *')).map((el) => {
      const cs = getComputedStyle(el);
      return `${el.tagName.toLowerCase()}: ${cs.transitionProperty} ${cs.transitionDuration} ${cs.transitionTimingFunction}`;
    }).filter((line) => !line.includes(': all 0s ease')),
  );
}

/** Counts pixels whose channels differ by more than `threshold` (0-255), comparing in a browser canvas. */
export async function pixelDiff(page: Page, a: Buffer, b: Buffer, threshold = 24) {
  return page.evaluate(
    async ([a64, b64, t]) => {
      const load = (src: string) =>
        new Promise<HTMLImageElement>((ok, fail) => {
          const img = new Image();
          img.onload = () => ok(img);
          img.onerror = fail;
          img.src = 'data:image/png;base64,' + src;
        });
      const [ia, ib] = await Promise.all([load(a64 as string), load(b64 as string)]);
      if (ia.width !== ib.width || ia.height !== ib.height) return { differing: -1, total: 0 };
      const data = (img: HTMLImageElement) => {
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const g = c.getContext('2d')!;
        g.drawImage(img, 0, 0);
        return g.getImageData(0, 0, img.width, img.height).data;
      };
      const da = data(ia);
      const db = data(ib);
      let differing = 0;
      for (let i = 0; i < da.length; i += 4) {
        if (Math.abs(da[i]! - db[i]!) > (t as number) || Math.abs(da[i + 1]! - db[i + 1]!) > (t as number) || Math.abs(da[i + 2]! - db[i + 2]!) > (t as number)) differing++;
      }
      return { differing, total: da.length / 4 };
    },
    [a.toString('base64'), b.toString('base64'), threshold] as const,
  );
}

/**
 * Brings the pages' performance clocks (which drive animation frames and packets)
 * to the same reading, by advancing the ones that lag.
 */
export async function align(...pages: Page[]) {
  const nows = await Promise.all(pages.map((p) => p.evaluate(() => performance.now())));
  const max = Math.max(...nows);
  await Promise.all(pages.map((p, i) => (max > nows[i]! ? p.clock.runFor(max - nows[i]!) : undefined)));
}
