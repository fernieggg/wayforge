import type {
  BoxMetrics,
  ContainerMetrics,
  ResolvedNode,
  RoundMetrics,
  Theme,
  Vec,
} from '../model/types';

export interface TextSpec {
  x: number;
  y: number;
  text: string;
  cls: string;
  anchor: 'start' | 'middle' | 'end';
}

export interface RowSpec {
  rect: { x: number; y: number; width: number; height: number; rx: number };
  text: TextSpec;
}

export interface PillSpec {
  rect: { x: number; y: number; width: number; height: number; rx: number };
  text: TextSpec;
}

export type ShapeSpec =
  | { tag: 'rect'; x: number; y: number; width: number; height: number; rx: number }
  | { tag: 'circle'; cx: number; cy: number; r: number }
  | { tag: 'polygon'; points: Vec[] };

// Integrity rejects metrics that do not apply to a node's kind, so plain spreads are safe.
export function boxMetrics(n: ResolvedNode, theme: Theme): BoxMetrics {
  return { ...theme.metrics.box, ...n.metrics };
}

export function roundMetrics(n: ResolvedNode, theme: Theme): RoundMetrics {
  return { ...(n.kind === 'diamond' ? theme.metrics.diamond : theme.metrics.circle), ...n.metrics };
}

export function containerMetrics(n: ResolvedNode, theme: Theme): ContainerMetrics {
  return { ...theme.metrics.container, ...n.metrics };
}

export function nodeShape(n: ResolvedNode, theme: Theme): ShapeSpec {
  const [x, y] = n.at;
  const [w, h] = n.size;
  switch (n.kind) {
    case 'circle':
      return { tag: 'circle', cx: x + w / 2, cy: y + h / 2, r: Math.min(w, h) / 2 };
    case 'diamond':
      return { tag: 'polygon', points: [[x + w / 2, y], [x + w, y + h / 2], [x + w / 2, y + h], [x, y + h / 2]] };
    case 'container':
      return { tag: 'rect', x, y, width: w, height: h, rx: containerMetrics(n, theme).radius };
    default:
      return { tag: 'rect', x, y, width: w, height: h, rx: boxMetrics(n, theme).radius };
  }
}

/** Title and subtitle placement for each kind. */
export function nodeTexts(n: ResolvedNode, theme: Theme): TextSpec[] {
  const [x, y] = n.at;
  const [w, h] = n.size;
  const cy = y + h / 2;
  if (n.kind === 'box') {
    const m = boxMetrics(n, theme);
    if (n.subtitle === undefined) return [{ x: x + m.inset, y: cy + m.titleDy, text: n.title, cls: 't', anchor: 'start' }];
    return [
      { x: x + m.inset, y: cy + m.titleDySub, text: n.title, cls: 't', anchor: 'start' },
      { x: x + m.inset, y: cy + m.subDy, text: n.subtitle, cls: 's', anchor: 'start' },
    ];
  }
  if (n.kind === 'container') {
    const m = containerMetrics(n, theme);
    return [{ x: x + m.titleOffset[0], y: y + m.titleOffset[1], text: n.title, cls: 'ftitle', anchor: 'start' }];
  }
  const m = roundMetrics(n, theme);
  const cx = x + w / 2;
  const out: TextSpec[] = [{ x: cx, y: cy + m.titleDy, text: n.title, cls: 't', anchor: 'middle' }];
  if (n.subtitle !== undefined) out.push({ x: cx, y: y + h + m.subGap, text: n.subtitle, cls: 's', anchor: 'middle' });
  return out;
}

export function containerRows(n: ResolvedNode, theme: Theme): RowSpec[] {
  const m = containerMetrics(n, theme);
  const [x, y] = n.at;
  const [w] = n.size;
  const rx = x + m.rowInset;
  return n.rows.map((row, i) => {
    const ry = y + m.rowsTop + i * m.rowPitch;
    return {
      rect: { x: rx, y: ry, width: w - 2 * m.rowInset, height: m.rowHeight, rx: m.rowRadius },
      text: { x: rx + m.rowTextInset, y: ry + theme.metrics.container.rowTextDy, text: row.text, cls: '', anchor: 'start' },
    };
  });
}

/** Pills straddle the top edge, right-aligned, laid out right to left in declaration order. */
export function nodePills(n: ResolvedNode, theme: Theme): PillSpec[] {
  const p = theme.metrics.pill;
  const top = n.at[1];
  let right = n.at[0] + n.size[0] - p.inset;
  return n.pills.map((pill) => {
    const x = right - pill.width;
    right = x - p.inset;
    return {
      rect: { x, y: top - p.height / 2, width: pill.width, height: p.height, rx: p.height / 2 },
      text: { x: x + pill.width / 2, y: top + p.textDy, text: pill.text, cls: 'badge-tx', anchor: 'middle' },
    };
  });
}
