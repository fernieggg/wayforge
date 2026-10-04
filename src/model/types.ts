import type {
  Effect,
  Meta,
  NodeMetrics,
  Ui,
  WayforgeJourney,
  WayforgeTheme,
} from './schema-types';

export type Journey = WayforgeJourney;
export type Theme = WayforgeTheme;
export type { Effect, NodeMetrics };

export type Vec = [number, number];
export type Box = [number, number, number, number];
export type NodeKind = 'box' | 'circle' | 'diamond' | 'container';

export type BoxMetrics = Theme['metrics']['box'];
export type RoundMetrics = Theme['metrics']['circle'];
export type ContainerMetrics = Theme['metrics']['container'];

export interface ResolvedPill {
  text: string;
  tone: string;
  width: number;
  hideIn: string[];
}

export interface ResolvedRow {
  id?: string;
  text: string;
}

export interface ResolvedNode {
  id: string;
  kind: NodeKind;
  at: Vec;
  size: Vec;
  title: string;
  subtitle?: string;
  layer?: string;
  tone: string;
  outline: 'normal' | 'strong';
  pills: ResolvedPill[];
  rows: ResolvedRow[];
  rowStyle: 'outline' | 'tint';
  lenses: string[];
  offsetByLens: Record<string, Vec>;
  metrics: NodeMetrics;
}

export interface ResolvedEdge {
  id: string;
  path: string;
  layer?: string;
  tone: string;
  dashed: boolean;
  hidden: boolean;
  lenses: string[];
}

export interface ResolvedLabel {
  edge: string;
  at: Vec;
  text: string;
  anchor: 'start' | 'middle' | 'end';
  layer?: string;
  lenses: string[];
}

export interface ResolvedPanel {
  id: string;
  rect: Box;
  tone: string;
  layer?: string;
  lenses: string[];
  title?: { text: string; at: Vec };
}

export interface ResolvedRoute {
  edges: string[];
  phase: number;
  dim: boolean;
}

export interface ResolvedScene {
  key: string;
  label: string;
  title: string;
  caption: string;
  camera: Box;
  wide: boolean;
  layers: string[];
  nodes: string[];
  edges: string[];
  routes: ResolvedRoute[];
  effects: Effect[];
}

export interface ResolvedLayer {
  id: string;
  tone: string;
  ghost: number;
}

export interface ResolvedJourney {
  meta: Required<Pick<Meta, 'title' | 'lang'>> & Pick<Meta, 'brand' | 'description'> & { favicon?: string };
  ui: Required<Ui>;
  theme: Theme;
  lenses: { id: string; label: string }[];
  defaultLens: string;
  layers: ResolvedLayer[];
  stageOrder: string[];
  panels: ResolvedPanel[];
  nodes: ResolvedNode[];
  edges: ResolvedEdge[];
  labels: ResolvedLabel[];
  scenes: Record<string, ResolvedScene[]>;
}

export interface Issue {
  level: 'error' | 'warning';
  rule: string;
  path: string;
  message: string;
}
