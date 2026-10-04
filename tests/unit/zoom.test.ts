import { describe, expect, it } from 'vitest';
import { absoluteTransform, compose, fitTransform, flowBounds, IDENTITY, toAbsoluteCamera, translate, zoomFrame } from '../../src/geometry/zoom';
import type { ResolvedNode } from '../../src/model/types';

const node = (at: [number, number], size: [number, number], offsetByLens: Record<string, [number, number]> = {}) =>
  ({ at, size, offsetByLens }) as unknown as ResolvedNode;
const apply = (t: { s: number; tx: number; ty: number }, [x, y]: [number, number]) => [t.s * x + t.tx, t.s * y + t.ty];

describe('flowBounds', () => {
  it('unions nodes, their lens offsets and panels', () => {
    const b = flowBounds({
      nodes: [node([0, 0], [100, 50]), node([200, 100], [50, 50], { other: [0, 200] })],
      panels: [{ rect: [-20, 10, 40, 40] } as never],
    });
    expect(b).toEqual([-20, 0, 270, 350]);
  });
  it('is null for an empty flow', () => {
    expect(flowBounds({ nodes: [], panels: [] })).toBeNull();
  });
});

describe('fitTransform', () => {
  it('fits uniformly, centered, with padding', () => {
    // A 200x100 flow into a 100x100 box with 10% padding: width-limited, scale 0.4, centered vertically.
    const t = fitTransform([0, 0, 200, 100], [1000, 500, 100, 100], 0.1);
    expect(t.s).toBeCloseTo(0.4);
    expect(apply(t, [0, 0])).toEqual([1010, 530]);
    expect(apply(t, [200, 100])).toEqual([1090, 570]);
  });
});

describe('compose and cameras', () => {
  it('composes outer after inner', () => {
    const inner = { s: 0.5, tx: 10, ty: 20 };
    const outer = { s: 2, tx: 100, ty: 0 };
    const p: [number, number] = [4, 6];
    expect(apply(compose(outer, inner), p)).toEqual(apply(outer, apply(inner, p) as [number, number]));
    expect(compose(IDENTITY, inner)).toEqual(inner);
  });
  it('maps a sub-flow camera through a lens offset and a fit', () => {
    const fit = fitTransform([0, 0, 1000, 500], [100, 100, 200, 100], 0);
    const abs = compose(translate(0, 50), fit);
    expect(toAbsoluteCamera(abs, [0, 0, 1000, 500])).toEqual([100, 150, 200, 100]);
  });
});

describe('zoomFrame', () => {
  const a = [0, 0, 1600, 800];
  const b = [700, 350, 16, 8];
  it('starts and ends exactly on the two cameras', () => {
    expect(zoomFrame(a, b, 0).map((v) => +v.toFixed(6))).toEqual(a);
    expect(zoomFrame(a, b, 1).map((v) => +v.toFixed(6))).toEqual(b);
  });
  it('changes size geometrically', () => {
    expect(zoomFrame(a, b, 0.5)[2]).toBeCloseTo(160);
  });
  it('keeps the destination in view throughout', () => {
    for (let e = 0; e <= 1; e += 0.05) {
      const [x, y, w, h] = zoomFrame(a, b, e);
      expect(x).toBeLessThanOrEqual(b[0]! + 1e-6);
      expect(y).toBeLessThanOrEqual(b[1]! + 1e-6);
      expect(x + w).toBeGreaterThanOrEqual(b[0]! + b[2]! - 1e-6);
      expect(y + h).toBeGreaterThanOrEqual(b[1]! + b[3]! - 1e-6);
    }
  });
});

describe('absoluteTransform', () => {
  const fitA = { s: 0.5, tx: 100, ty: 100 };
  const fitB = { s: 0.1, tx: 10, ty: 20 };
  const flows = [
    { parent: null },
    { parent: 0, fit: fitA, ownerOffsetByLens: { moved: [0, 40] } },
    { parent: 1, fit: fitB },
  ];
  it('is the identity for the root', () => {
    expect(absoluteTransform(flows, 0, () => 'any')).toEqual(IDENTITY);
  });
  it('follows the owner when the parent lens moves it', () => {
    expect(absoluteTransform(flows, 1, () => 'still')).toEqual(fitA);
    expect(absoluteTransform(flows, 1, () => 'moved')).toEqual({ s: 0.5, tx: 100, ty: 140 });
  });
  it('chains through nested sub-flows', () => {
    expect(absoluteTransform(flows, 2, () => 'moved')).toEqual(compose({ s: 0.5, tx: 100, ty: 140 }, fitB));
  });
});
