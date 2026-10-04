import { containerRows, nodePills, nodeShape, nodeTexts, type ShapeSpec, type TextSpec } from '../geometry/shapes';
import type { ResolvedJourney, ResolvedNode, ResolvedScene } from '../model/types';
import { attrs, esc } from './escape';

const ly = (layer: string | undefined) => layer && `ly-${layer}`;
const cls = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ');

function text(t: TextSpec, extra: Record<string, string | undefined> = {}): string {
  return `<text${attrs({ x: t.x, y: t.y, class: t.cls, 'text-anchor': t.anchor, ...extra })}>${esc(t.text)}</text>`;
}

function shape(s: ShapeSpec): string {
  if (s.tag === 'circle') return `<circle${attrs({ cx: s.cx, cy: s.cy, r: s.r })}/>`;
  if (s.tag === 'polygon') return `<polygon${attrs({ points: s.points.map((p) => p.join(',')).join(' ') })}/>`;
  return `<rect${attrs({ x: s.x, y: s.y, width: s.width, height: s.height, rx: s.rx })}/>`;
}

export interface SceneState {
  lens: string;
  scene: ResolvedScene;
}

/** Map markup in paint order: panels, edges, labels, packets, nodes. Packets sit beneath nodes on purpose. */
export function buildSvg(r: ResolvedJourney, initial: SceneState): string {
  const { theme } = r;
  const { lens, scene } = initial;
  const lensAttr = (lenses: string[]) => lenses.join(' ');
  const out = (lenses: string[]) => !lenses.includes(lens) && 'lens-out';
  const activeNodes = new Set(scene.nodes);
  const activeEdges = new Set(scene.edges);

  const panels = r.panels.map((p) => {
    const [x, y, w, h] = p.rect;
    const title = p.title
      ? text({ x: p.title.at[0], y: p.title.at[1], text: p.title.text, cls: `plabel t-${p.tone}`, anchor: 'start' })
      : '';
    return `<g${attrs({ class: cls('decor', ly(p.layer), out(p.lenses)), id: `p-${p.id}`, 'data-lenses': lensAttr(p.lenses) })}>`
      + `<rect${attrs({ class: `panel t-${p.tone}`, x, y, width: w, height: h, rx: theme.metrics.panel.radius })}/>${title}</g>`;
  });

  const edges = r.edges.map((e) =>
    `<path${attrs({
      d: e.path,
      id: `e-${e.id}`,
      class: cls('edge', `t-${e.tone}`, ly(e.layer), e.hidden && 'hid', e.dashed && 'dash', activeEdges.has(e.id) && 'on', out(e.lenses)),
      'data-lenses': lensAttr(e.lenses),
    })}/>`,
  );

  const labels = r.labels.map((l) =>
    text(
      { x: l.at[0], y: l.at[1], text: l.text, cls: cls('lab', ly(l.layer), activeEdges.has(l.edge) && 'on', out(l.lenses)), anchor: l.anchor },
      { 'data-edge': l.edge, 'data-lenses': lensAttr(l.lenses) },
    ),
  );

  const nodes = r.nodes.map((n) => node(r, n, lens, activeNodes.has(n.id), out(n.lenses)));

  const svgClass = cls(`lens-${lens}`, ...scene.layers.map((l) => `lyon-${l}`));
  const blur = theme.packet.glowBlur;
  return `<svg${attrs({
    id: 'map',
    class: svgClass,
    viewBox: scene.camera.join(' '),
    preserveAspectRatio: 'xMidYMid meet',
    role: 'img',
    'aria-label': r.meta.description ?? r.meta.title,
  })}>`
    + `<defs><filter id="glow" x="-300%" y="-300%" width="700%" height="700%"><feGaussianBlur stdDeviation="${blur}"/></filter></defs>`
    + `<g id="decor">${panels.join('')}</g>`
    + `<g id="edges">${edges.join('')}</g>`
    + `<g id="labels">${labels.join('')}</g>`
    + `<g id="packets"></g>`
    + `<g id="nodes">${nodes.join('')}</g>`
    + `</svg>`;
}

function node(r: ResolvedJourney, n: ResolvedNode, lens: string, active: boolean, lensOut: string | false): string {
  const { theme } = r;
  const offset = n.offsetByLens[lens];
  const parts = [shape(nodeShape(n, theme)), ...nodeTexts(n, theme).map((t) => text(t))];
  nodePills(n, theme).forEach((p, i) => {
    const pill = n.pills[i]!;
    parts.push(
      `<g${attrs({ class: cls('pill-g', ...pill.hideIn.map((l) => `hide-${l}`)) })}>`
        + `<rect${attrs({ class: `pill pt-${pill.tone}`, ...p.rect })}/>${text(p.text)}</g>`,
    );
  });
  if (n.kind === 'container') {
    containerRows(n, theme).forEach((row, i) => {
      const id = n.rows[i]!.id;
      parts.push(
        `<g${attrs({ class: cls('row', n.rowStyle === 'tint' && 'row-tint'), 'data-row': id })}>`
          + `<rect${attrs(row.rect)}/>${text(row.text)}</g>`,
      );
    });
  }
  return `<g${attrs({
    class: cls('node', `t-${n.tone}`, ly(n.layer), n.outline === 'strong' && 'strong', active && 'on', lensOut),
    id: `n-${n.id}`,
    'data-lenses': n.lenses.join(' '),
    style: offset ? `transform: translate(${offset[0]}px, ${offset[1]}px);` : undefined,
  })}>${parts.join('')}</g>`;
}
