import type { Effect, ResolvedJourney, Theme, Vec } from '../model/types';

/** Everything the browser runtime needs. The map itself is already in the markup. */
export interface RuntimeData {
  lenses: string[];
  defaultLens: string;
  stageOrder: string[];
  layers: string[];
  offsets: Record<string, Record<string, Vec>>;
  scenes: Record<string, RuntimeScene[]>;
  packet: Theme['packet'];
  dim: number;
  motion: { camera: number; caption: number; rowCycle: number; swipe: number };
  stepLabel: string;
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
}

export function runtimeData(r: ResolvedJourney): RuntimeData {
  const offsets: RuntimeData['offsets'] = {};
  for (const n of r.nodes) if (Object.keys(n.offsetByLens).length) offsets[n.id] = n.offsetByLens;
  const scenes: RuntimeData['scenes'] = {};
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
    }));
  }
  const m = r.theme.motion;
  return {
    lenses: r.lenses.map((l) => l.id),
    defaultLens: r.defaultLens,
    stageOrder: r.stageOrder,
    layers: r.layers.map((l) => l.id),
    offsets,
    scenes,
    packet: r.theme.packet,
    dim: r.theme.opacity.dim,
    motion: { camera: m.camera, caption: m.caption, rowCycle: m.rowCycle, swipe: m.swipe },
    stepLabel: r.ui.step,
  };
}
