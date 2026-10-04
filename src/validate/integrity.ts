import { pathEnds } from '../geometry/path';
import { expandRefs, GroupError } from '../model/groups';
import type { Issue, Journey, Theme } from '../model/types';
import { visibleIn } from '../model/visibility';

const KIND_METRICS: Record<string, readonly string[]> = {
  box: ['radius', 'inset', 'titleDy', 'titleDySub', 'subDy'],
  circle: ['titleDy', 'subGap'],
  diamond: ['titleDy', 'subGap'],
  container: ['radius', 'titleOffset', 'rowsTop', 'rowInset', 'rowTextInset', 'rowHeight', 'rowPitch', 'rowRadius'],
};

/** Theme-internal references: the default tone and every tone's variables exist in both palettes. */
export function checkTheme(theme: Theme, label = 'theme'): Issue[] {
  const issues: Issue[] = [];
  const err = (path: string, message: string) => issues.push({ level: 'error', rule: 'theme', path, message });
  if (!theme.tones[theme.defaultTone]) err(`${label}.defaultTone`, `unknown tone "${theme.defaultTone}"`);
  for (const [name, tone] of Object.entries(theme.tones)) {
    if (!tone) continue;
    for (const slot of ['color', 'soft', 'panel'] as const) {
      const v = tone[slot];
      if (v === undefined) continue;
      for (const scheme of ['light', 'dark'] as const) {
        if (theme.colors[scheme][v] === undefined)
          err(`${label}.tones.${name}.${slot}`, `color "${v}" is not defined in colors.${scheme}`);
      }
    }
  }
  return issues;
}

/** Reference-integrity rules. Assumes the journey passed the JSON Schema. */
export function checkIntegrity(j: Journey, theme: Theme): Issue[] {
  const issues: Issue[] = [];
  const err = (rule: string, path: string, message: string) => issues.push({ level: 'error', rule, path, message });

  const lensIds = new Set<string>();
  const layerIds = new Set<string>();
  const nodeIds = new Map<string, Journey['nodes'][number]>();
  const edgeIds = new Map<string, Journey['edges'][number]>();

  const unique = <T extends { id?: string }>(list: readonly T[], what: string, into: (item: T) => void) =>
    list.forEach((item, i) => {
      if (item.id === undefined) return;
      const before = issues.length;
      for (let k = 0; k < i; k++) {
        if (list[k]!.id === item.id) {
          err('duplicate-id', `${what}[${i}](${item.id})`, `duplicate ${what.replace(/s$/, '')} id "${item.id}" (first at ${what}[${k}])`);
          break;
        }
      }
      if (issues.length === before) into(item);
    });

  unique(j.lenses, 'lenses', (l) => lensIds.add(l.id));
  unique(j.layers ?? [], 'layers', (l) => layerIds.add(l.id));
  unique(j.nodes, 'nodes', (n) => nodeIds.set(n.id, n));
  unique(j.edges, 'edges', (e) => edgeIds.set(e.id, e));
  unique(j.panels ?? [], 'panels', () => {});
  unique(j.labels ?? [], 'labels', () => {});

  const defaults = j.lenses.filter((l) => l.default);
  if (defaults.length > 1) err('default-lens', 'lenses', `more than one default lens: ${defaults.map((l) => l.id).join(', ')}`);

  const tone = (t: string | undefined, path: string) => {
    if (t !== undefined && !theme.tones[t]) err('unknown-tone', path, `unknown tone "${t}" (theme defines ${Object.keys(theme.tones).join(', ')})`);
  };
  const layer = (l: string | undefined, path: string) => {
    if (l !== undefined && !layerIds.has(l)) err('unknown-layer', path, `unknown layer "${l}"`);
  };
  const lenses = (list: readonly string[] | undefined, path: string) =>
    list?.forEach((l, i) => {
      if (!lensIds.has(l)) err('unknown-lens', `${path}[${i}]`, `unknown lens "${l}"`);
    });
  const positive = (v: readonly number[], from: number, path: string, what: string) => {
    if (v.slice(from).some((x) => !(x > 0))) err('bad-size', path, `${what} must have a positive width and height`);
  };

  (j.layers ?? []).forEach((l, i) => tone(l.tone, `layers[${i}](${l.id}).tone`));

  const seenStages = new Set<string>();
  j.stageOrder.forEach((s, i) => {
    if (seenStages.has(s)) err('duplicate-id', `stageOrder[${i}]`, `stage "${s}" appears twice`);
    seenStages.add(s);
  });

  (j.panels ?? []).forEach((p, i) => {
    const at = `panels[${i}](${p.id})`;
    tone(p.tone, `${at}.tone`);
    layer(p.layer, `${at}.layer`);
    lenses(p.lenses, `${at}.lenses`);
    positive(p.rect, 2, `${at}.rect`, 'rect');
  });

  j.nodes.forEach((n, i) => {
    const at = `nodes[${i}](${n.id})`;
    tone(n.tone, `${at}.tone`);
    layer(n.layer, `${at}.layer`);
    lenses(n.lenses, `${at}.lenses`);
    positive(n.size, 0, `${at}.size`, 'size');
    for (const lens of Object.keys(n.offsetByLens ?? {}))
      if (!lensIds.has(lens)) err('unknown-lens', `${at}.offsetByLens.${lens}`, `unknown lens "${lens}"`);
    (n.pills ?? []).forEach((p, k) => {
      tone(p.tone, `${at}.pills[${k}].tone`);
      lenses(p.hideIn, `${at}.pills[${k}].hideIn`);
    });
    if (n.kind !== 'container') {
      if (n.rows !== undefined) err('rows-not-container', `${at}.rows`, `only containers have rows (kind is "${n.kind}")`);
      if (n.rowStyle !== undefined) err('rows-not-container', `${at}.rowStyle`, `only containers have rows (kind is "${n.kind}")`);
    }
    const allowed = KIND_METRICS[n.kind] ?? [];
    for (const key of Object.keys(n.metrics ?? {}))
      if (!allowed.includes(key)) err('bad-metric', `${at}.metrics.${key}`, `metric "${key}" does not apply to kind "${n.kind}"`);
    const rowIds = new Set<string>();
    (n.rows ?? []).forEach((r, k) => {
      if (typeof r === 'string' || r.id === undefined) return;
      if (rowIds.has(r.id)) err('duplicate-id', `${at}.rows[${k}]`, `duplicate row id "${r.id}"`);
      rowIds.add(r.id);
    });
  });

  j.edges.forEach((e, i) => {
    const at = `edges[${i}](${e.id})`;
    tone(e.tone, `${at}.tone`);
    layer(e.layer, `${at}.layer`);
    lenses(e.lenses, `${at}.lenses`);
    if (!pathEnds(e.path)) err('bad-path', `${at}.path`, 'malformed SVG path data');
  });

  (j.labels ?? []).forEach((l, i) => {
    const at = `labels[${i}]` + (l.id ? `(${l.id})` : '');
    if (!edgeIds.has(l.edge)) err('unknown-edge', `${at}.edge`, `unknown edge "${l.edge}"`);
    layer(l.layer, `${at}.layer`);
    lenses(l.lenses, `${at}.lenses`);
  });

  const groups = j.groups ?? {};
  for (const [name, members] of Object.entries(groups)) {
    try {
      expandRefs(members ?? [], groups);
    } catch (e) {
      if (e instanceof GroupError) err('bad-group', `groups.${name}`, e.message);
      else throw e;
    }
  }

  for (const key of Object.keys(j.scenes))
    if (!lensIds.has(key)) err('unknown-lens', `scenes.${key}`, `scenes given for unknown lens "${key}"`);

  for (const lens of j.lenses) {
    const list = j.scenes[lens.id];
    if (!list || list.length === 0) {
      err('lens-without-scenes', `scenes.${lens.id}`, `lens "${lens.id}" has no scenes`);
      continue;
    }
    list.forEach((s, i) => {
      const at = `scenes.${lens.id}[${i}]`;
      const ctx = ` (scene "${s.key}")`;
      if (!j.stageOrder.includes(s.key)) err('key-not-in-stage-order', `${at}.key`, `key "${s.key}" is not in stageOrder`);
      positive(s.camera, 2, `${at}.camera`, 'camera');
      (s.layers ?? []).forEach((l, k) => layer(l, `${at}.layers[${k}]`));

      for (const kind of ['nodes', 'edges'] as const) {
        const refs = s.active[kind] ?? [];
        const known = kind === 'nodes' ? nodeIds : edgeIds;
        refs.forEach((ref, k) => {
          let ids: string[];
          try {
            ids = expandRefs([ref], groups);
          } catch (e) {
            if (e instanceof GroupError) {
              err('bad-group', `${at}.active.${kind}[${k}]`, e.message + ctx);
              return;
            }
            throw e;
          }
          for (const id of ids)
            if (!known.has(id))
              err(`unknown-${kind.slice(0, -1)}`, `${at}.active.${kind}[${k}]`, `unknown ${kind.slice(0, -1)} "${id}"${ref !== id ? ` (via ${ref})` : ''}${ctx}`);
        });
      }

      (s.routes ?? []).forEach((r, k) =>
        r.edges.forEach((id, m) => {
          const path = `${at}.routes[${k}].edges[${m}]`;
          const edge = edgeIds.get(id);
          if (!edge) err('unknown-edge', path, `unknown edge "${id}"${ctx}`);
          else if (!visibleIn(edge.lenses, lens.id))
            err('route-edge-not-in-lens', path, `edge "${id}" is not visible in lens "${lens.id}"${ctx}`);
        }),
      );

      if (s.enter !== undefined) {
        const owner = nodeIds.get(s.enter) ?? (j.panels ?? []).find((p) => p.id === s.enter);
        if (!owner) err('unknown-enter', `${at}.enter`, `unknown node or panel "${s.enter}"${ctx}`);
        else if (!owner.zoom) err('enter-not-zoomable', `${at}.enter`, `"${s.enter}" has no zoom, so there is nothing to enter${ctx}`);
        else if (!visibleIn(owner.lenses, lens.id)) err('enter-not-in-lens', `${at}.enter`, `"${s.enter}" is not visible in lens "${lens.id}"${ctx}`);
      }

      (s.effects ?? []).forEach((fx, k) => {
        const path = `${at}.effects[${k}]`;
        const node = nodeIds.get(fx.node);
        if (!node) return err('unknown-node', `${path}.node`, `unknown node "${fx.node}"${ctx}`);
        if (node.kind !== 'container') return err('effect-not-container', `${path}.node`, `${fx.type} needs a container, "${fx.node}" is a ${node.kind}${ctx}`);
        const rows = node.rows ?? [];
        if (fx.type === 'cycleRows' && rows.length === 0) err('effect-no-rows', `${path}.node`, `container "${fx.node}" has no rows${ctx}`);
        if (fx.type === 'highlightRow' && !rows.some((r) => typeof r !== 'string' && r.id === fx.row))
          err('unknown-row', `${path}.row`, `container "${fx.node}" has no row with id "${fx.row}"${ctx}`);
      });
    });
  }

  return issues;
}
