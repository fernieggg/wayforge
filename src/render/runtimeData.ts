import type { Transform } from '../geometry/zoom';
import type { Flow } from '../model/tree';
import type { Effect, Theme, Vec } from '../model/types';

/** Everything the browser runtime needs. The maps themselves are already in the markup. */
export interface RuntimeData {
  flows: RuntimeFlow[];
  motion: { camera: number; caption: number; zoom: number; swipe: number };
  ui: { step: string; hint: string; exit: string };
}

export interface RuntimeFlow {
  prefix: string;
  label: string;
  parent: number | null;
  fit?: Transform;
  ownerOffsetByLens?: Record<string, Vec>;
  /** Zoomable element id -> sub-flow index. */
  zooms: Record<string, number>;
  lenses: { id: string; label: string }[];
  defaultLens: string;
  stageOrder: string[];
  layers: string[];
  offsets: Record<string, Record<string, Vec>>;
  scenes: Record<string, RuntimeScene[]>;
  packet: Theme['packet'];
  dim: number;
  rowCycle: number;
}

export interface RuntimeScene {
  key: string;
  label: string;
  title: string;
  caption: string;
  camera: number[];
  layers: string[];
  nodes: string[];
  edges: string[];
  routes: { edges: string[]; phase: number; dim: boolean }[];
  effects: Effect[];
  enter?: string;
}

function runtimeFlow(f: Flow): RuntimeFlow {
  const r = f.resolved;
  const offsets: RuntimeFlow['offsets'] = {};
  for (const n of r.nodes) if (Object.keys(n.offsetByLens).length) offsets[n.id] = n.offsetByLens;
  const scenes: RuntimeFlow['scenes'] = {};
  for (const [lens, list] of Object.entries(r.scenes)) {
    scenes[lens] = list.map((s) => ({
      key: s.key,
      label: s.label,
      title: s.title,
      caption: s.caption,
      camera: s.camera,
      layers: s.layers,
      nodes: s.nodes,
      edges: s.edges,
      routes: s.routes,
      effects: s.effects,
      ...(s.enter !== undefined && f.children[s.enter] !== undefined ? { enter: s.enter } : {}),
    }));
  }
  return {
    prefix: f.prefix,
    label: f.label,
    parent: f.parent,
    ...(f.fit ? { fit: f.fit } : {}),
    ...(f.owner && Object.keys(f.owner.offsetByLens).length ? { ownerOffsetByLens: f.owner.offsetByLens } : {}),
    zooms: f.children,
    lenses: r.lenses,
    defaultLens: r.defaultLens,
    stageOrder: r.stageOrder,
    layers: r.layers.map((l) => l.id),
    offsets,
    scenes,
    packet: r.theme.packet,
    dim: r.theme.opacity.dim,
    rowCycle: r.theme.motion.rowCycle,
  };
}

export function runtimeData(flows: readonly Flow[]): RuntimeData {
  const root = flows[0]!.resolved;
  const m = root.theme.motion;
  return {
    flows: flows.map(runtimeFlow),
    motion: { camera: m.camera, caption: m.caption, zoom: m.zoom ?? 1.6, swipe: m.swipe },
    ui: { step: root.ui.step, hint: root.ui.hint, exit: root.ui.exit },
  };
}
