import { containerRows, nodePills, nodeShape, nodeTexts, type ShapeSpec, type TextSpec } from '../geometry/shapes';
import { absoluteTransform, matrix } from '../geometry/zoom';
import type { Flow } from '../model/tree';
import type { Box, ResolvedJourney, ResolvedNode, ResolvedScene } from '../model/types';
import { fill } from './chrome';
import { attrs, esc } from './escape';
import { pid } from '../model/ids';

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

interface ZoomTarget {
  index: number;
  label: string;
}

/** The marker on a zoomable element: a small circle with a plus, at the bottom-right of its box. */
function badge(r: ResolvedJourney, box: Box, tone: string): string {
  const { radius, inset } = r.theme.metrics.zoomBadge ?? { radius: 11, inset: 16 };
  const cx = box[0] + box[2] - inset;
  const cy = box[1] + box[3] - inset;
  const arm = radius * 0.45;
  return `<g class="zoom-badge"><circle${attrs({ class: `zb zt-${tone}`, cx, cy, r: radius })}/>`
    + `<path${attrs({ d: `M${cx - arm} ${cy}H${cx + arm}M${cx} ${cy - arm}V${cy + arm}` })}/></g>`;
}

function zoomAttrs(r: ResolvedJourney, target: ZoomTarget | undefined): Record<string, string | number | undefined> {
  if (!target) return {};
  return { 'data-zoom': target.index, tabindex: 0, role: 'button', 'aria-label': fill(r.ui.open, { title: target.label }) };
}

/** One flow's map in paint order: panels, edges, labels, packets, nodes. Packets sit beneath nodes on purpose. */
function flowGroup(flow: Flow, flows: readonly Flow[], initial: SceneState, visible: boolean, transform: string | undefined): string {
  const r = flow.resolved;
  const p = flow.prefix;
  const { theme } = r;
  const { lens, scene } = initial;
  const lensAttr = (lenses: string[]) => lenses.join(' ');
  const out = (lenses: string[]) => !lenses.includes(lens) && 'lens-out';
  const activeNodes = new Set(scene.nodes);
  const activeEdges = new Set(scene.edges);
  const target = (id: string): ZoomTarget | undefined => {
    const index = flow.children[id];
    return index === undefined ? undefined : { index, label: flows[index]!.label };
  };

  const panels = r.panels.map((pn) => {
    const [x, y, w, h] = pn.rect;
    const zoom = target(pn.id);
    const title = pn.title
      ? text({ x: pn.title.at[0], y: pn.title.at[1], text: pn.title.text, cls: `plabel t-${pn.tone}`, anchor: 'start' })
      : '';
    return `<g${attrs({
      class: cls('decor', ly(pn.layer), zoom && 'zoomable', out(pn.lenses)),
      id: pid(p, `p-${pn.id}`),
      'data-lenses': lensAttr(pn.lenses),
      ...zoomAttrs(r, zoom),
    })}>`
      + `<rect${attrs({ class: `panel t-${pn.tone}`, x, y, width: w, height: h, rx: theme.metrics.panel.radius })}/>${title}`
      + (zoom && pn.zoom?.badge ? badge(r, pn.rect, pn.tone) : '')
      + `</g>`;
  });

  const edges = r.edges.map((e) =>
    `<path${attrs({
      d: e.path,
      id: pid(p, `e-${e.id}`),
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

  const nodes = r.nodes.map((n) => node(r, p, n, lens, activeNodes.has(n.id), out(n.lenses), target(n.id)));

  const filter = pid(p, 'glow');
  return `<g${attrs({
    class: cls('wf-flow', `wf-f${flow.index}`, `lens-${lens}`, ...scene.layers.map((l) => `lyon-${l}`)),
    'data-flow': flow.index,
    transform,
    style: visible ? undefined : 'opacity:0;pointer-events:none',
  })}>`
    + `<defs><filter id="${filter}" x="-300%" y="-300%" width="700%" height="700%"><feGaussianBlur stdDeviation="${theme.packet.glowBlur}"/></filter></defs>`
    + `<g id="${pid(p, 'decor')}">${panels.join('')}</g>`
    + `<g id="${pid(p, 'edges')}">${edges.join('')}</g>`
    + `<g id="${pid(p, 'labels')}">${labels.join('')}</g>`
    + `<g id="${pid(p, 'packets')}"></g>`
    + `<g id="${pid(p, 'nodes')}">${nodes.join('')}</g>`
    + `</g>`;
}

function node(r: ResolvedJourney, p: string, n: ResolvedNode, lens: string, active: boolean, lensOut: string | false, zoom: ZoomTarget | undefined): string {
  const { theme } = r;
  const offset = n.offsetByLens[lens];
  const parts = [shape(nodeShape(n, theme)), ...nodeTexts(n, theme).map((t) => text(t))];
  nodePills(n, theme).forEach((pill, i) => {
    const spec = n.pills[i]!;
    parts.push(
      `<g${attrs({ class: cls('pill-g', ...spec.hideIn.map((l) => `hide-${l}`)) })}>`
        + `<rect${attrs({ class: `pill pt-${spec.tone}`, ...pill.rect })}/>${text(pill.text)}</g>`,
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
  if (zoom && n.zoom?.badge) parts.push(badge(r, [n.at[0], n.at[1], n.size[0], n.size[1]], n.tone));
  return `<g${attrs({
    class: cls('node', `t-${n.tone}`, ly(n.layer), n.outline === 'strong' && 'strong', zoom && 'zoomable', active && 'on', lensOut),
    id: pid(p, `n-${n.id}`),
    'data-lenses': n.lenses.join(' '),
    style: offset ? `transform: translate(${offset[0]}px, ${offset[1]}px);` : undefined,
    ...zoomAttrs(r, zoom),
  })}>${parts.join('')}</g>`;
}

export const placements = (flows: readonly Flow[]) =>
  flows.map((f) => ({ parent: f.parent, fit: f.fit, ownerOffsetByLens: f.owner?.offsetByLens }));

/**
 * The whole map: one SVG whose viewBox is the camera, holding every flow as a sibling group.
 * The root flow starts visible on its default lens's first scene; sub-flows start hidden,
 * already placed inside their owners.
 */
export function buildSvg(flows: readonly Flow[]): string {
  const root = flows[0]!.resolved;
  const first = (f: Flow): SceneState => ({ lens: f.resolved.defaultLens, scene: f.resolved.scenes[f.resolved.defaultLens]![0]! });
  const place = placements(flows);
  const groups = flows.map((f) => {
    const t = f.index === 0 ? undefined : matrix(absoluteTransform(place, f.index, (i) => flows[i]!.resolved.defaultLens));
    return flowGroup(f, flows, first(f), f.index === 0, t);
  });
  return `<svg${attrs({
    id: 'map',
    viewBox: first(flows[0]!).scene.camera.join(' '),
    preserveAspectRatio: 'xMidYMid meet',
    role: 'img',
    'aria-label': root.meta.description ?? root.meta.title,
  })}>${groups.join('')}</svg>`;
}
