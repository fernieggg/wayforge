import { existsSync } from 'node:fs';
import { basename, dirname, relative, resolve } from 'node:path';
import { fitTransform, flowBounds, type Transform } from '../geometry/zoom';
import { validateFile } from '../validate';
import type { Box, Issue, ResolvedJourney, Vec } from './types';

/** One journey placed in the presentation: the root, or a sub-flow opened from a zoomable element. */
export interface Flow {
  index: number;
  /** Id prefix in the built page: "" for the root, "z1", "z2"... for sub-flows. */
  prefix: string;
  file: string;
  resolved: ResolvedJourney;
  parent: number | null;
  /** Breadcrumb name. */
  label: string;
  /** For sub-flows: the element it opens from, in the parent's coordinates. */
  owner?: { id: string; kind: 'node' | 'panel'; box: Box; offsetByLens: Record<string, Vec> };
  /** For sub-flows: places this flow's map inside the owner's box (before the owner's lens offset). */
  fit?: Transform;
  /** Owner element id -> index of the sub-flow it opens. */
  children: Record<string, number>;
}

export interface TreeResult {
  issues: Issue[];
  /** Present only when no file in the tree has errors. */
  flows?: Flow[];
}

/**
 * Validates a journey and every sub-flow it references (recursively), and places each
 * sub-flow inside the element that opens it. Each reference is its own flow instance,
 * so one file can be opened from several places. References back to an ancestor are errors.
 */
export function loadTree(rootFile: string): TreeResult {
  const root = resolve(rootFile);
  const base = dirname(root);
  const issues: Issue[] = [];
  const flows: Flow[] = [];
  const name = (f: string) => relative(base, f).replace(/\\/g, '/') || basename(f);

  function visit(file: string, parent: number | null, owner: Flow['owner'] | undefined, label: string | undefined, chain: string[], prefix: string): number | null {
    const result = validateFile(file);
    for (const i of result.issues) issues.push(prefix ? { ...i, path: `${prefix}${i.path}` } : i);
    if (!result.resolved) return null;
    const r = result.resolved;

    const index = flows.length;
    const flow: Flow = {
      index,
      prefix: index === 0 ? '' : `z${index}`,
      file,
      resolved: r,
      parent,
      label: label ?? (parent === null ? r.meta.brand ?? r.meta.title : r.meta.title),
      owner,
      children: {},
    };
    if (owner) {
      const bounds = flowBounds(r);
      if (!bounds || bounds[2] <= 0 || bounds[3] <= 0) {
        issues.push({ level: 'error', rule: 'empty-sub-flow', path: `${prefix}nodes`, message: 'a sub-flow needs at least one node to place inside its owner' });
        return null;
      }
      flow.fit = fitTransform(bounds, owner.box);
    }
    flows.push(flow);

    const owners = [
      ...r.nodes.map((n, i) => ({ el: n, path: `nodes[${i}](${n.id})`, kind: 'node' as const, box: [n.at[0], n.at[1], n.size[0], n.size[1]] as Box, offsetByLens: n.offsetByLens })),
      ...r.panels.map((p, i) => ({ el: p, path: `panels[${i}](${p.id})`, kind: 'panel' as const, box: p.rect, offsetByLens: {} })),
    ];
    for (const o of owners) {
      if (!o.el.zoom) continue;
      const target = resolve(dirname(file), o.el.zoom.journey);
      const at = `${prefix}${o.path}.zoom.journey`;
      if (chain.includes(target)) {
        issues.push({ level: 'error', rule: 'zoom-cycle', path: at, message: `zoom cycle: ${[...chain, target].map(name).join(' -> ')}` });
        continue;
      }
      if (!existsSync(target)) {
        issues.push({ level: 'error', rule: 'zoom-missing', path: at, message: `cannot find "${o.el.zoom.journey}" (looked for ${target})` });
        continue;
      }
      const child = visit(
        target,
        index,
        { id: o.el.id, kind: o.kind, box: o.box, offsetByLens: o.offsetByLens },
        o.el.zoom.label,
        [...chain, target],
        `${prefix}${name(target)} (via ${o.path}.zoom) › `,
      );
      if (child !== null) flow.children[o.el.id] = child;
    }
    return index;
  }

  visit(root, null, undefined, undefined, [root], '');
  return issues.some((i) => i.level === 'error') ? { issues } : { issues, flows };
}

