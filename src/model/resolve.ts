import { expandRefs } from './groups';
import type {
  Journey,
  ResolvedEdge,
  ResolvedJourney,
  ResolvedNode,
  ResolvedScene,
  Theme,
  Vec,
} from './types';
import type { Ui } from './schema-types';

export const DEFAULT_UI: Required<Ui> = {
  back: 'Back',
  next: 'Next',
  fullscreen: 'Full screen',
  hint: 'Arrow keys to move, {keys} to switch lens',
  lensGroup: 'Lens',
  steps: 'Journey steps',
  step: 'Step {n}: {label}',
};

export function pillWidth(text: string, theme: Theme): number {
  const p = theme.metrics.pill;
  return Math.round(text.length * p.charWidth + p.padding);
}

/**
 * Turns a valid journey into explicit data: defaults applied, groups expanded,
 * every lens list spelled out, tones and label inheritance settled.
 * Assumes the journey has passed validation.
 */
export function resolveJourney(j: Journey, theme: Theme): ResolvedJourney {
  const allLenses = j.lenses.map((l) => l.id);
  const groups = j.groups ?? {};
  const layers = (j.layers ?? []).map((l) => ({ id: l.id, tone: l.tone, ghost: l.ghost }));
  const layerTone = new Map(layers.map((l) => [l.id, l.tone]));
  const toneFor = (tone: string | undefined, layer: string | undefined) =>
    tone ?? (layer ? layerTone.get(layer) : undefined) ?? theme.defaultTone;

  const nodes: ResolvedNode[] = j.nodes.map((n) => ({
    id: n.id,
    kind: n.kind,
    at: n.at,
    size: n.size,
    title: n.title,
    subtitle: n.subtitle,
    layer: n.layer,
    tone: toneFor(n.tone, n.layer),
    outline: n.outline ?? 'normal',
    pills: (n.pills ?? []).map((p) => ({
      text: p.text,
      tone: p.tone,
      width: p.width ?? pillWidth(p.text, theme),
      hideIn: p.hideIn ?? [],
    })),
    rows: (n.rows ?? []).map((r) => (typeof r === 'string' ? { text: r } : { id: r.id, text: r.text })),
    rowStyle: n.rowStyle ?? 'outline',
    lenses: n.lenses ?? allLenses,
    offsetByLens: (n.offsetByLens ?? {}) as Record<string, Vec>,
    metrics: n.metrics ?? {},
  }));

  const edges: ResolvedEdge[] = j.edges.map((e) => ({
    id: e.id,
    path: e.path,
    layer: e.layer,
    tone: toneFor(e.tone, e.layer),
    dashed: e.dashed ?? false,
    hidden: e.hidden ?? false,
    lenses: e.lenses ?? allLenses,
  }));
  const edgeById = new Map(edges.map((e) => [e.id, e]));

  const labels = (j.labels ?? []).map((l) => {
    const edge = edgeById.get(l.edge);
    return {
      edge: l.edge,
      at: l.at,
      text: l.text,
      anchor: l.anchor ?? 'start',
      layer: l.layer ?? edge?.layer,
      lenses: l.lenses ?? edge?.lenses ?? allLenses,
    };
  });

  const panels = (j.panels ?? []).map((p) => ({
    id: p.id,
    rect: p.rect,
    tone: p.tone,
    layer: p.layer,
    lenses: p.lenses ?? allLenses,
    title: p.title,
  }));

  const scenes: Record<string, ResolvedScene[]> = {};
  for (const lens of allLenses) {
    scenes[lens] = (j.scenes[lens] ?? []).map((s) => ({
      key: s.key,
      label: s.label,
      title: s.title,
      caption: s.caption,
      camera: s.camera,
      wide: s.wide ?? false,
      layers: s.layers ?? [],
      nodes: expandRefs(s.active.nodes ?? [], groups),
      edges: expandRefs(s.active.edges ?? [], groups),
      routes: (s.routes ?? []).map((r) => ({ edges: r.edges, phase: r.phase ?? 0, dim: r.dim ?? false })),
      effects: s.effects ?? [],
    }));
  }

  const meta = j.meta;
  return {
    meta: {
      title: meta.title,
      lang: meta.lang ?? 'en',
      brand: meta.brand,
      description: meta.description,
      favicon: meta.favicon ?? undefined,
    },
    ui: { ...DEFAULT_UI, ...j.ui },
    theme,
    lenses: j.lenses.map((l) => ({ id: l.id, label: l.label })),
    defaultLens: (j.lenses.find((l) => l.default) ?? j.lenses[0]).id,
    layers,
    stageOrder: j.stageOrder,
    panels,
    nodes,
    edges,
    labels,
    scenes,
  };
}
