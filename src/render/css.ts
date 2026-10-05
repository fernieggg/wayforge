import type { ResolvedJourney, Theme } from '../model/types';

const v = (name: string) => `var(--${name})`;

export function fontStack(font: Theme['fonts']['text']): string {
  return `"${font.family}",${font.fallback.split(',').map((s) => s.trim()).join(',')}`;
}

function palette(colors: Record<string, string | undefined>): string {
  return Object.entries(colors)
    .filter(([, value]) => value !== undefined)
    .map(([k, value]) => `--${k}:${value};`)
    .join(' ');
}

function rootVars(theme: Theme): string {
  const dark = palette(theme.colors.dark);
  return [
    `:root{box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);${palette(theme.colors.light)}}`,
    `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${dark}}}`,
    `:root[data-theme="dark"]{${dark}}`,
  ].join('\n');
}

/** Page chrome: header, footer, buttons, dots. */
function chromeCss(theme: Theme): string {
  const text = fontStack(theme.fonts.text);
  const heading = fontStack(theme.fonts.heading);
  const accent = v(theme.tones[theme.defaultTone]!.color);
  const { gridDot, gridSpacing } = theme.background;
  return `
html{height:100%;scroll-padding-top:env(safe-area-inset-top,0px)}
html,body{margin:0}
body{height:100%;background:var(--bg);color:var(--ink);font-family:${text};display:flex;flex-direction:column;overflow:hidden;position:relative}
body::before{content:"";position:fixed;inset:0;pointer-events:none;z-index:0;background-image:radial-gradient(var(--grid) ${gridDot}px, transparent ${gridDot}px);background-size:${gridSpacing}px ${gridSpacing}px;-webkit-mask-image:radial-gradient(ellipse at 50% 38%, #000 25%, transparent 78%);mask-image:radial-gradient(ellipse at 50% 38%, #000 25%, transparent 78%)}
body::after{content:"";position:fixed;inset:0;pointer-events:none;z-index:0;background:radial-gradient(ellipse 60% 45% at 50% 0%, var(--glow), transparent 70%)}
header,main,footer{position:relative;z-index:1}
header{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:14px 28px 0}
.brand{font:400 13px ${heading};letter-spacing:.02em;color:var(--muted)}
.hint{font-size:14px;color:var(--muted);margin-right:12px}
.hdr-right{display:flex;align-items:center}
.lens{display:flex;gap:4px;padding:4px;border:1px solid var(--node-line);border-radius:999px;background:var(--glass)}
.lens-btn{font:500 14px ${text};color:var(--muted);background:transparent;border:0;padding:8px 20px;border-radius:999px;cursor:pointer;transition:background .25s,color .25s}
.lens-btn:hover{color:var(--ink)}
.lens-btn[aria-pressed="true"]{background:${accent};color:var(--btn-ink)}
.lens-btn:focus-visible{outline:2px solid ${accent};outline-offset:2px}
main{flex:1;min-height:0;display:flex}
#map{width:100%;height:100%;display:block}
footer{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:24px 40px;align-items:end;padding:20px 28px 24px;background:var(--glass);border-top:1px solid var(--node-line);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}
#cap{transition:opacity ${theme.motion.caption}s ease}
#cap.out{opacity:0}
#ct{margin:0 0 10px;font:500 clamp(20px,2.4vw,34px)/1.15 ${heading};letter-spacing:-.01em}
#cx{margin:0;max-width:64ch;font-size:clamp(16px,1.3vw,20px);line-height:1.5;color:var(--muted)}
.nav{display:flex;flex-direction:column;align-items:flex-end;gap:16px}
.btns{display:flex;gap:10px}
.btn{font:500 15px ${text};color:var(--ink);background:transparent;border:1px solid var(--node-line);border-radius:999px;padding:10px 20px;cursor:pointer;transition:background .2s,border-color .2s,opacity .2s}
.btn:hover:not(:disabled){border-color:${accent}}
.btn.primary{background:${accent};border-color:${accent};color:var(--btn-ink)}
.btn:disabled{opacity:.35;cursor:default}
.btn:focus-visible,.dot:focus-visible{outline:2px solid ${accent};outline-offset:3px}
.dots{display:flex;gap:8px;align-items:center}
.dot{width:22px;height:14px;padding:4px 0;border:0;border-radius:7px;cursor:pointer;background-color:var(--node-line);background-clip:content-box;transition:width .3s,background-color .3s}
.dot[aria-current="true"]{width:40px;background-color:${accent}}
[hidden]{display:none !important}
.crumbs{display:flex;align-items:center;flex-wrap:wrap;gap:4px 8px;font:400 13px ${heading};letter-spacing:.02em;color:var(--muted)}
.crumbs button{font:inherit;letter-spacing:inherit;color:inherit;background:none;border:0;padding:2px 0;cursor:pointer}
.crumbs button:hover{color:var(--ink)}
.crumbs button:focus-visible{outline:2px solid ${accent};outline-offset:2px}
.crumbs [aria-current]{color:var(--ink)}
.crumbs .sep{opacity:.6}
@media (max-width:900px){.brand{display:none}header{justify-content:space-between}}
@media (max-width:760px){header{padding:10px 16px 0}.hint{display:none}.lens-btn{padding:8px 14px}footer{grid-template-columns:1fr;padding:16px 16px 18px}.nav{flex-direction:row;align-items:center;justify-content:space-between;width:100%}}
@media (max-height:520px){footer{padding:10px 20px 12px;gap:12px 24px}#ct{font-size:18px;margin-bottom:4px}#cx{font-size:14px;line-height:1.35}}`;
}

/**
 * Map styles. Opacity is always base x ghost x lens, each a CSS variable so each
 * factor transitions on its own. Selector specificity is deliberate so the
 * cascade resolves as intended (for example, rows inherit a strong outline).
 */
function mapCss(r: ResolvedJourney): string {
  const { theme } = r;
  const text = fontStack(theme.fonts.text);
  const m = theme.metrics;
  const t = m.type;
  const o = theme.opacity;
  const mo = theme.motion;
  const opacity = 'opacity:calc(var(--base) * var(--ghost,1) * var(--lens,1))';
  const shapes = (sel: string) => ['rect', 'polygon', 'circle'].map((s) => `${sel} ${s}`).join(',');
  const defaultColor = v(theme.tones[theme.defaultTone]!.color);
  const out: string[] = [];

  out.push(
    `.t{font:600 ${t.title}px ${text};fill:var(--ink)}`,
    `.s{font:400 ${t.subtitle}px ${text};fill:var(--muted)}`,
    `.lab{font:400 ${t.label}px ${text};fill:var(--muted);--base:${o.label};${opacity};transition:opacity ${mo.fade}s}`,
    `.lab.on{--base:1}`,
    `.plabel{font:500 ${t.panelTitle}px ${text}}`,
    `.ftitle{font:600 ${t.containerTitle}px ${text};fill:var(--ink)}`,
  );
  for (const layer of r.layers) out.push(`.ly-${layer.id}{--ghost:${layer.ghost}}`, `.lyon-${layer.id} .ly-${layer.id}{--ghost:1}`);
  out.push(
    `.decor{opacity:calc(var(--ghost,1) * var(--lens,1));transition:opacity ${mo.decorFade}s}`,
    `.lens-out{--lens:0;pointer-events:none}`,
    `.panel{fill:transparent;stroke-width:${m.panel.stroke};stroke-dasharray:${m.panel.dash.join(' ')};stroke-linecap:round}`,
  );

  out.push(
    `.node{--base:${o.node};${opacity};transition:opacity ${mo.fade}s,transform ${mo.glide}s ${mo.glideEase}}`,
    `.node.on{--base:1}`,
    `${shapes('.node')}{fill:var(--node);stroke:var(--node-line);stroke-width:${m.box.stroke};transition:stroke ${mo.stroke}s}`,
    `${shapes('.node.on')}{stroke:${defaultColor}}`,
  );
  const tones = Object.entries(theme.tones).filter((e): e is [string, NonNullable<(typeof e)[1]>] => e[1] !== undefined);
  for (const [name, tone] of tones) out.push(`${shapes(`.node.t-${name}.on`)}{stroke:${v(tone.color)}}`);
  out.push(`${shapes('.node.strong.on')}{stroke-width:${m.box.strongStroke}}`);
  for (const [name, tone] of tones)
    out.push(`.node rect.pill.pt-${name},.node.on rect.pill.pt-${name}{fill:${v(tone.color)};stroke:${v(tone.color)};stroke-width:0}`);
  out.push(
    `.badge-tx{font:600 ${t.pill}px ${text};fill:var(--btn-ink)}`,
    `.pill-g{transition:opacity ${mo.pillFade}s}`,
  );
  for (const lens of r.lenses) out.push(`.lens-${lens.id} .hide-${lens.id}{opacity:0}`);

  const c = m.container;
  out.push(
    `.row rect{fill:transparent;stroke:var(--node-line);stroke-width:${c.rowStroke};transition:fill ${mo.row}s,stroke ${mo.row}s}`,
    `.row text{font:500 ${t.row}px ${text};fill:var(--muted);transition:fill ${mo.row}s}`,
  );
  for (const [name, tone] of tones) if (tone.soft) out.push(`.node.t-${name} .row.hot rect{fill:${v(tone.soft)};stroke:${v(tone.color)}}`);
  out.push(`.row.hot text{fill:var(--ink)}`);
  for (const [name, tone] of tones) if (tone.soft) out.push(`.node.t-${name}.on .row-tint rect{fill:${v(tone.soft)};stroke:${v(tone.color)}}`);
  out.push(`.node.on .row-tint text{fill:var(--ink)}`);
  for (const [name, tone] of tones)
    out.push(`.node.t-${name}.on .row.lit rect{fill:${v(tone.color)};fill-opacity:${c.highlightFillOpacity};stroke:${v(tone.color)};stroke-width:${c.highlightStroke}}`);
  out.push(`.node.on .row.lit text{fill:var(--ink)}`);

  for (const [name, tone] of tones)
    out.push(`.panel.t-${name}{fill:${tone.panel ? v(tone.panel) : 'transparent'};stroke:${v(tone.color)}}`, `.plabel.t-${name}{fill:${v(tone.color)}}`);

  out.push(
    `.edge{fill:none;stroke:var(--node-line);stroke-width:${m.edge.stroke};--base:${o.edge};${opacity};transition:opacity ${mo.fade}s,stroke ${mo.fade}s}`,
    `.edge.on{--base:1;stroke:${defaultColor};stroke-width:${m.edge.activeStroke}}`,
  );
  for (const [name, tone] of tones) out.push(`.edge.t-${name}.on{stroke:${v(tone.color)}}`);
  out.push(
    `.edge.hid{stroke:none !important}`,
    `.edge.dash{stroke-dasharray:${m.edge.dash.join(' ')}}`,
    `.pk,.pk-glow{fill:var(--packet)}`,
  );
  return out.join('\n');
}

/** Zoomable elements: pointer, focus ring, and the marker in the owner's tone. */
function zoomCss(r: ResolvedJourney): string {
  const out = [
    '.zoomable{cursor:pointer}',
    '.zoomable:focus{outline:none}',
    '.zoom-badge{transition:transform .2s;transform-box:fill-box;transform-origin:center}',
    '.zoomable:hover .zoom-badge,.zoomable:focus-visible .zoom-badge{transform:scale(1.2)}',
    '.zoom-badge path{fill:none;stroke:var(--btn-ink);stroke-width:2;stroke-linecap:round}',
  ];
  for (const [name, tone] of Object.entries(r.theme.tones))
    if (tone) out.push(`.node .zoom-badge circle.zb.zt-${name},.decor .zoom-badge circle.zb.zt-${name}{fill:${v(tone.color)};stroke:none}`);
  out.push('.zoomable:focus-visible .zoom-badge circle.zb{stroke:var(--ink);stroke-width:2}');
  return out.join('\n');
}

/**
 * Prefixes every rule with a flow's scope class. Each selector gains exactly one class,
 * so the cascade inside a flow resolves as before. Lens and layer state classes sit on
 * the flow group itself, so those selectors attach to the scope instead of nesting under it.
 */
export function scopeRules(css: string, scope: string): string {
  return css
    .split('\n')
    .map((rule) => {
      const brace = rule.indexOf('{');
      if (brace < 0 || rule.startsWith('@')) return rule;
      const selectors = rule
        .slice(0, brace)
        .split(',')
        .map((sel) => sel.trim())
        .map((sel) => (STATE.test(sel) ? `${scope}${sel}` : `${scope} ${sel}`));
      return selectors.join(',') + rule.slice(brace);
    })
    .join('\n');
}

const STATE = new RegExp('^[.](lens|lyon)-[A-Za-z0-9_-]+ ');

/** Sub-flows may use another theme; their colors are scoped to their group. */
function flowVars(theme: Theme, scope: string): string {
  const dark = palette(theme.colors.dark);
  return [
    `${scope}{${palette(theme.colors.light)}}`,
    `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]) ${scope}{${dark}}}`,
    `:root[data-theme="dark"] ${scope}{${dark}}`,
  ].join('\n');
}

/** Page chrome from the root flow's theme; map styles per flow, each under its own scope. */
export function buildCss(flows: readonly { resolved: ResolvedJourney }[]): string {
  const root = flows[0]!.resolved;
  const parts = [rootVars(root.theme), chromeCss(root.theme)];
  const motionOff = ['#cap', '.dot'];
  flows.forEach((f, i) => {
    const scope = `.wf-f${i}`;
    if (i > 0) parts.push(flowVars(f.resolved.theme, scope));
    parts.push(scopeRules(mapCss(f.resolved), scope), scopeRules(zoomCss(f.resolved), scope));
    motionOff.push(...['.node', '.edge', '.lab', '.decor'].map((sel) => `${scope} ${sel}`));
  });
  parts.push(`@media (prefers-reduced-motion: reduce){${motionOff.join(',')}{transition:none}}`);
  return parts.join('\n');
}
