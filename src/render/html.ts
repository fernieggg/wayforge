import type { ResolvedJourney, Theme } from '../model/types';
import { buildFooter, buildHeader } from './chrome';
import { buildCss } from './css';
import { attrs, esc, scriptJson } from './escape';
import { runtimeData } from './runtimeData';
import { buildSvg } from './svg';

export function googleFontsUrl(theme: Theme): string | null {
  const fonts = [theme.fonts.text, theme.fonts.heading].filter((f) => f.google !== false);
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

/** Assembles the single self-contained page. `runtimeJs` is the bundled browser runtime. */
export function buildHtml(r: ResolvedJourney, runtimeJs: string): string {
  const lens = r.defaultLens;
  const scenes = r.scenes[lens]!;
  const fonts = googleFontsUrl(r.theme);
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
${buildCss(r)}
</style>
</head>
<body>
${buildHeader(r, lens)}
<main>
${buildSvg(r, { lens, scene: scenes[0]! })}
</main>
${buildFooter(r, scenes, 0)}
<script type="application/json" id="wf-data">${scriptJson(runtimeData(r))}</script>
<script>${runtimeJs.replace(/<\/script/gi, '<\\/script')}</script>
</body>
</html>
`;
}
