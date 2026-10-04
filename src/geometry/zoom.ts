import type { Box, ResolvedJourney } from '../model/types';

/** Uniform scale then translate: a point p in the child maps to s * p + (tx, ty) in the parent. */
export interface Transform {
  s: number;
  tx: number;
  ty: number;
}

export const IDENTITY: Transform = { s: 1, tx: 0, ty: 0 };

/** Fraction of the owner box left empty on each side around a sub-flow. */
export const FIT_PADDING = 0.06;

/** Union of every node and panel box, in every lens (lens offsets included). */
export function flowBounds(r: Pick<ResolvedJourney, 'nodes' | 'panels'>): Box | null {
  const boxes: Box[] = [];
  for (const n of r.nodes) {
    for (const [dx, dy] of [[0, 0], ...Object.values(n.offsetByLens)])
      boxes.push([n.at[0] + dx!, n.at[1] + dy!, n.size[0], n.size[1]]);
  }
  for (const p of r.panels) boxes.push(p.rect);
  if (!boxes.length) return null;
  const x0 = Math.min(...boxes.map((b) => b[0]));
  const y0 = Math.min(...boxes.map((b) => b[1]));
  const x1 = Math.max(...boxes.map((b) => b[0] + b[2]));
  const y1 = Math.max(...boxes.map((b) => b[1] + b[3]));
  return [x0, y0, x1 - x0, y1 - y0];
}

/** Fits `bounds` uniformly inside `box`, centered, leaving `padding` (a fraction of the box) on each side. */
export function fitTransform(bounds: Box, box: Box, padding = FIT_PADDING): Transform {
  const [bx, by, bw, bh] = bounds;
  const ax = box[0] + box[2] * padding;
  const ay = box[1] + box[3] * padding;
  const aw = box[2] * (1 - 2 * padding);
  const ah = box[3] * (1 - 2 * padding);
  const s = Math.min(aw / bw, ah / bh);
  return { s, tx: ax + (aw - bw * s) / 2 - bx * s, ty: ay + (ah - bh * s) / 2 - by * s };
}

/** outer after inner: compose(o, i) maps p to o(i(p)). */
export function compose(outer: Transform, inner: Transform): Transform {
  return { s: outer.s * inner.s, tx: outer.s * inner.tx + outer.tx, ty: outer.s * inner.ty + outer.ty };
}

export function translate(dx: number, dy: number): Transform {
  return { s: 1, tx: dx, ty: dy };
}

/** A camera rectangle in a flow's own coordinates, mapped to root map coordinates. */
export function toAbsoluteCamera(t: Transform, cam: readonly number[]): Box {
  return [t.s * cam[0]! + t.tx, t.s * cam[1]! + t.ty, t.s * cam[2]!, t.s * cam[3]!];
}

export function matrix(t: Transform): string {
  return `matrix(${t.s} 0 0 ${t.s} ${t.tx} ${t.ty})`;
}

/**
 * One frame of a zoom flight from camera `a` to camera `b` at eased progress `e`.
 * Size changes geometrically (even perceived speed across large scale changes), and the
 * center moves in step with the size change so the destination stays in view.
 */
export function zoomFrame(a: readonly number[], b: readonly number[], e: number): Box {
  const lerpLog = (p: number, q: number) => Math.exp(Math.log(p) + (Math.log(q) - Math.log(p)) * e);
  const w = lerpLog(a[2]!, b[2]!);
  const h = lerpLog(a[3]!, b[3]!);
  const f = Math.abs(a[2]! - b[2]!) < 1e-9 ? e : (a[2]! - w) / (a[2]! - b[2]!);
  const cx = a[0]! + a[2]! / 2 + (b[0]! + b[2]! / 2 - (a[0]! + a[2]! / 2)) * f;
  const cy = a[1]! + a[3]! / 2 + (b[1]! + b[3]! / 2 - (a[1]! + a[3]! / 2)) * f;
  return [cx - w / 2, cy - h / 2, w, h];
}

/** What placing a flow needs: its parent, its fit inside the owner, and the owner's per-lens offsets. */
export interface Placement {
  parent: number | null;
  fit?: Transform;
  ownerOffsetByLens?: Record<string, readonly number[]>;
}

/**
 * Root-coordinate transform of flow `i`: the parent's transform, then the owner's offset in the
 * parent's current lens (owners can glide per lens), then the fit inside the owner.
 */
export function absoluteTransform(flows: readonly Placement[], i: number, lensOf: (flow: number) => string): Transform {
  const f = flows[i];
  if (!f || f.parent === null || !f.fit) return IDENTITY;
  const [dx, dy] = f.ownerOffsetByLens?.[lensOf(f.parent)] ?? [0, 0];
  return compose(absoluteTransform(flows, f.parent, lensOf), compose(translate(dx!, dy!), f.fit));
}
