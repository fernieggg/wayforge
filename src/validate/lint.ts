import { pathEnds } from '../geometry/path';
import type { Issue, ResolvedJourney, ResolvedNode, Vec } from '../model/types';

const GAP_TOLERANCE = 1;

function nodeBox(n: ResolvedNode, lens: string): [number, number, number, number] {
  const [dx, dy] = n.offsetByLens[lens] ?? [0, 0];
  return [n.at[0] + dx, n.at[1] + dy, n.size[0], n.size[1]];
}

function inside(p: Vec, [x, y, w, h]: [number, number, number, number]): boolean {
  const t = GAP_TOLERANCE;
  return p[0] >= x - t && p[0] <= x + w + t && p[1] >= y - t && p[1] <= y + h + t;
}

/** Warnings: things that build fine but probably look wrong. */
export function lint(r: ResolvedJourney): Issue[] {
  const issues: Issue[] = [];
  const warn = (rule: string, path: string, message: string) => issues.push({ level: 'warning', rule, path, message });
  const { theme } = r;
  const nodeById = new Map(r.nodes.map((n) => [n.id, n]));
  const edgeById = new Map(r.edges.map((e) => [e.id, e]));
  const ends = new Map(r.edges.map((e) => [e.id, pathEnds(e.path)]));

  // Readability: on-screen size ~ screenWidth / cameraWidth x fontSize, for the smallest reading text.
  const readingFont = Math.min(theme.metrics.type.label, theme.metrics.type.subtitle);
  const { minTextPx, referenceScreenWidth } = theme.lint;

  for (const lens of r.lenses) {
    (r.scenes[lens.id] ?? []).forEach((s, i) => {
      const at = `scenes.${lens.id}[${i}]`;
      const ctx = ` (scene "${s.key}")`;

      const px = (referenceScreenWidth / s.camera[2]) * readingFont;
      if (!s.wide && px < minTextPx)
        warn('readability', `${at}.camera`,
          `text would render at about ${px.toFixed(1)}px on a ${referenceScreenWidth}px screen (minimum ${minTextPx}px); narrow the camera or mark the scene "wide"${ctx}`);

      for (const id of s.nodes) {
        const n = nodeById.get(id);
        if (n && !n.lenses.includes(lens.id)) warn('active-not-visible', `${at}.active.nodes`, `node "${id}" is active but not visible in lens "${lens.id}"${ctx}`);
      }
      for (const id of s.edges) {
        const e = edgeById.get(id);
        if (e && !e.lenses.includes(lens.id)) warn('active-not-visible', `${at}.active.edges`, `edge "${id}" is active but not visible in lens "${lens.id}"${ctx}`);
      }

      s.routes.forEach((route, k) => {
        for (let m = 0; m + 1 < route.edges.length; m++) {
          const a = ends.get(route.edges[m]!)?.end;
          const b = ends.get(route.edges[m + 1]!)?.start;
          if (!a || !b) continue;
          if (Math.hypot(a[0] - b[0], a[1] - b[1]) <= GAP_TOLERANCE) continue;
          // A jump is invisible when it happens underneath one node, since packets draw beneath nodes.
          const covered = r.nodes.some((n) => n.lenses.includes(lens.id) && inside(a, nodeBox(n, lens.id)) && inside(b, nodeBox(n, lens.id)));
          if (!covered)
            warn('route-gap', `${at}.routes[${k}].edges[${m + 1}]`,
              `packet jumps from (${a.join(', ')}) at the end of "${route.edges[m]}" to (${b.join(', ')}) at the start of "${route.edges[m + 1]}", outside any node; add a hidden edge${ctx}`);
        }
      });

      if (s.enter !== undefined) {
        const n = nodeById.get(s.enter);
        const box = n ? nodeBox(n, lens.id) : r.panels.find((p) => p.id === s.enter)?.rect;
        const [cx, cy, cw, ch] = s.camera;
        if (box && (box[0] < cx || box[1] < cy || box[0] + box[2] > cx + cw || box[1] + box[3] > cy + ch))
          warn('enter-off-camera', `${at}.enter`, `"${s.enter}" is not fully inside this scene's camera, so the zoom starts from off screen${ctx}`);
      }

      s.effects.forEach((fx, k) => {
        const n = nodeById.get(fx.node);
        if (fx.type === 'cycleRows' && n && !theme.tones[n.tone]?.soft)
          warn('tone-without-soft', `${at}.effects[${k}]`, `tone "${n.tone}" of "${n.id}" has no soft color for highlighted rows${ctx}`);
      });
    });
  }

  r.nodes.forEach((n, i) => {
    if (n.kind !== 'container') {
      return;
    }
    const m = { ...theme.metrics.container, ...n.metrics };
    if (n.rows.length && m.rowsTop + (n.rows.length - 1) * m.rowPitch + m.rowHeight > n.size[1])
      warn('row-overflow', `nodes[${i}](${n.id}).rows`, `${n.rows.length} rows do not fit in height ${n.size[1]}`);
    if (n.subtitle !== undefined) warn('container-subtitle', `nodes[${i}](${n.id}).subtitle`, 'containers do not show a subtitle');
    if (n.rowStyle === 'tint' && !theme.tones[n.tone]?.soft)
      warn('tone-without-soft', `nodes[${i}](${n.id}).rowStyle`, `tone "${n.tone}" has no soft color for tinted rows`);
  });

  r.nodes.forEach((n, i) => {
    if (n.zoom && n.lenses.length === 0) warn('zoom-unreachable', `nodes[${i}](${n.id}).zoom`, 'this node is parked in every lens, so its sub-flow can never be opened');
  });
  r.panels.forEach((p, i) => {
    if (p.zoom && p.lenses.length === 0) warn('zoom-unreachable', `panels[${i}](${p.id}).zoom`, 'this panel is parked in every lens, so its sub-flow can never be opened');
  });

  r.labels.forEach((l, i) => {
    if (edgeById.get(l.edge)?.hidden) warn('label-on-hidden-edge', `labels[${i}]`, `label "${l.text}" is attached to hidden edge "${l.edge}"`);
  });

  return issues;
}
