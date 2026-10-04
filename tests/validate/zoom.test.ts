import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadTree } from '../../src/model/tree';
import { readJson } from '../../src/model/load';
import type { Issue } from '../../src/model/types';
import { validateJourney } from '../../src/validate';

const fixture = (f: string) => resolve(__dirname, 'fixtures/zoom', f);
const errors = (issues: Issue[]) => issues.filter((i) => i.level === 'error').map((i) => `${i.rule} @ ${i.path}`);

describe('zoom trees', () => {
  it('loads three nested levels and places each inside its owner', () => {
    const { issues, flows } = loadTree(fixture('root.json'));
    expect(errors(issues)).toEqual([]);
    expect(flows!.map((f) => [f.prefix, f.label, f.parent, f.owner?.id])).toEqual([
      ['', 'Root', null, undefined],
      ['z1', 'Child', 0, 'b'],
      ['z2', 'Grandchild', 1, 'c'],
    ]);
    expect(flows![0]!.children).toEqual({ b: 1 });
    expect(flows![1]!.children).toEqual({ c: 2 });
    // The child's map lies inside node b (300..500 x 100..200).
    const { s, tx, ty } = flows![1]!.fit!;
    const [x0, y0] = [s * 0 + tx, s * 100 + ty];
    const [x1, y1] = [s * 500 + tx, s * 200 + ty];
    expect(x0).toBeGreaterThanOrEqual(300);
    expect(y0).toBeGreaterThanOrEqual(100);
    expect(x1).toBeLessThanOrEqual(500);
    expect(y1).toBeLessThanOrEqual(200);
  });

  it('rejects a zoom cycle with the full chain', () => {
    const { issues, flows } = loadTree(fixture('loop-a.json'));
    expect(flows).toBeUndefined();
    const cycle = issues.find((i) => i.rule === 'zoom-cycle')!;
    expect(cycle.path).toBe('loop-b.json (via nodes[0](x).zoom) › nodes[0](y).zoom.journey');
    expect(cycle.message).toBe('zoom cycle: loop-a.json -> loop-b.json -> loop-a.json');
  });

  it('rejects a missing sub-flow file', () => {
    expect(errors(loadTree(fixture('missing.json')).issues)).toEqual(['zoom-missing @ nodes[0](x).zoom.journey']);
  });

  it('reports errors inside a sub-flow with a breadcrumb path', () => {
    expect(errors(loadTree(fixture('bad-parent.json')).issues)).toEqual([
      'unknown-enter @ bad-child.json (via nodes[0](x).zoom) › scenes.main[0].enter',
    ]);
  });

  it('rejects a sub-flow with nothing to place', () => {
    expect(errors(loadTree(fixture('empty-parent.json')).issues)).toEqual(['empty-sub-flow @ empty-child.json (via nodes[0](x).zoom) › nodes']);
  });
});

describe('scene.enter', () => {
  const theme = readJson(resolve(__dirname, '../../themes/default.json'));
  const run = (j: unknown) => validateJourney(j, () => theme).issues;

  it('must name a zoomable element', () => {
    expect(errors(loadTree(fixture('enter-plain.json')).issues)).toEqual(['enter-not-zoomable @ scenes.main[0].enter']);
  });

  it('must be visible in the scene lens', () => {
    const j = readJson(fixture('root.json')) as any;
    j.nodes[1].lenses = [];
    expect(errors(run(j))).toEqual(['enter-not-in-lens @ scenes.main[0].enter']);
  });

  it('warns when the zoom starts off camera, and when a zoom owner is parked', () => {
    const j = readJson(fixture('root.json')) as any;
    j.scenes.main[0].camera = [0, 0, 350, 400];
    const parked = readJson(fixture('child.json')) as any;
    parked.nodes[0].lenses = [];
    parked.scenes.main[0].active.nodes = ['d'];
    expect(run(j).map((i) => i.rule)).toContain('enter-off-camera');
    expect(run(parked).map((i) => i.rule)).toContain('zoom-unreachable');
  });
});
