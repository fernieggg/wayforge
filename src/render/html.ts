import type { Flow } from '../model/tree';
import type { Theme } from '../model/types';
import { buildFooter, buildHeader } from './chrome';
import { buildCss } from './css';
import { attrs, esc, scriptJson } from './escape';
import { runtimeData } from './runtimeData';
import { buildSvg } from './svg';

/** One stylesheet link for every Google font used by any flow (root fonts first). */
export function googleFontsUrl(themes: readonly Theme[]): string | null {
  const seen = new Set<string>();
  const fonts = themes
    .flatMap((t) => [t.fonts.text, t.fonts.heading])
    .filter((f) => f.google !== false)
    .filter((f) => {
      const key = `${f.family}:${[...f.weights].sort((a, b) => a - b).join(';')}`;
      return seen.has(key) ? false : (seen.add(key), true);
    });
  if (!fonts.length) return null;
  const families = fonts.map((f) => `family=${f.family.replace(/ /g, '+')}:wght@${[...f.weights].sort((a, b) => a - b).join(';')}`);
  return `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`;
}

function favicon(icon: string | undefined): string {
  if (!icon) return '';
  const href = icon.startsWith('data:')
    ? icon
    : `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${esc(icon)}</text></svg>`)}`;
  return `\n<link${attrs({ rel: 'icon', href })}>`;
}

/** Assembles the single self-contained page from a flow tree (the root and its sub-flows). */
export function buildHtml(flows: readonly Flow[], runtimeJs: string): string {
  const r = flows[0]!.resolved;
  const lens = r.defaultLens;
  const scenes = r.scenes[lens]!;
  const fonts = googleFontsUrl(flows.map((f) => f.resolved.theme));
  const fontLinks = fonts
    ? `\n<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link${attrs({ href: fonts, rel: 'stylesheet' })}>`
    : '';
  return `<!doctype html>
<html${attrs({ lang: r.meta.lang })}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="generator" content="Wayforge">
<title>${esc(r.meta.title)}</title>${favicon(r.meta.favicon)}${fontLinks}
<style>
${buildCss(flows)}
</style>
</head>
<body>
${buildHeader(r, lens)}
<main>
${buildSvg(flows)}
</main>
${buildFooter(r, scenes, 0)}
<script type="application/json" id="wf-data">${scriptJson(runtimeData(flows))}</script>
<script>${runtimeJs.replace(/<\/script/gi, '<\\/script')}</script>
</body>
</html>
`;
}
