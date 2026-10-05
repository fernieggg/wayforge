import { describe, expect, it } from 'vitest';
import { nodeTooOld } from '../../src/cli/node-version';
import { pathEnds } from '../../src/geometry/path';
import { expandRefs } from '../../src/model/groups';
import { deepMerge } from '../../src/model/merge';
import { placeKeepingIndex, visibleIn } from '../../src/model/visibility';

describe('pathEnds', () => {
  it('reads absolute commands', () => {
    expect(pathEnds('M270 145 C370 145 370 302 454 302')).toEqual({ start: [270, 145], end: [454, 302] });
    expect(pathEnds('M2070 235 L3110 235 Q3150 235 3150 275 L3150 665')).toEqual({ start: [2070, 235], end: [3150, 665] });
  });
  it('reads relative, H/V, implicit linetos and closepath', () => {
    expect(pathEnds('m10 10 h5 v-3 l1 1')).toEqual({ start: [10, 10], end: [16, 8] });
    expect(pathEnds('M0 0 10 10 20 0')).toEqual({ start: [0, 0], end: [20, 0] });
    expect(pathEnds('M5 5 L9 9 Z')).toEqual({ start: [5, 5], end: [5, 5] });
    expect(pathEnds('M0,0 A10,10 0 0 1 20,0')).toEqual({ start: [0, 0], end: [20, 0] });
  });
  it('rejects malformed data', () => {
    expect(pathEnds('')).toBeNull();
    expect(pathEnds('L0 0')).toBeNull();
    expect(pathEnds('M0 0 L5')).toBeNull();
    expect(pathEnds('M0 0 X5 5')).toBeNull();
  });
});

describe('expandRefs', () => {
  const groups = { a: ['x', 'y'], b: ['@a', 'z'], loop: ['@loop'] };
  it('expands nested groups and drops duplicates', () => {
    expect(expandRefs(['@b', 'x', 'w'], groups)).toEqual(['x', 'y', 'z', 'w']);
  });
  it('throws on unknown groups and cycles', () => {
    expect(() => expandRefs(['@nope'], groups)).toThrow(/unknown group/);
    expect(() => expandRefs(['@loop'], groups)).toThrow(/cycle/);
  });
});

describe('visibility', () => {
  it('treats a missing list as shared and an empty list as parked', () => {
    expect(visibleIn(undefined, 'any')).toBe(true);
    expect(visibleIn([], 'any')).toBe(false);
    expect(visibleIn(['a', 'b'], 'b')).toBe(true);
  });

  const order = ['overview', 'ads', 'landing', 'gate', 'data', 'sfrec', 'lcap', 'handoff', 'event', 'full'];
  const keys = (...k: string[]) => k.map((key) => ({ key }));
  it('keeps the same key when the lens has it', () => {
    expect(placeKeepingIndex(keys('overview', 'landing', 'data'), 'data', order)).toBe(2);
  });
  it('falls back to the nearest stage, later on a tie', () => {
    // From Both "gate" into Data: landing (distance 1) and data (distance 1) tie, so data wins.
    expect(placeKeepingIndex(keys('overview', 'landing', 'data', 'sfrec', 'lcap'), 'gate', order)).toBe(2);
    // From Data "sfrec" into Prospect: gate (2) vs handoff (2) tie, so handoff wins.
    expect(placeKeepingIndex(keys('overview', 'ads', 'landing', 'gate', 'handoff', 'full'), 'sfrec', order)).toBe(4);
  });
});

describe('deepMerge', () => {
  it('merges objects and replaces arrays', () => {
    expect(deepMerge({ a: { b: 1, c: [1, 2] }, d: 1 }, { a: { c: [3] } })).toEqual({ a: { b: 1, c: [3] }, d: 1 });
    expect(deepMerge({ a: 1 }, undefined)).toEqual({ a: 1 });
  });
});

describe('nodeTooOld', () => {
  it('compares versions numerically', () => {
    expect(nodeTooOld('20.10.0', '22.12.0')).toBe(true);
    expect(nodeTooOld('22.11.9', '22.12.0')).toBe(true);
    expect(nodeTooOld('22.12.0', '22.12.0')).toBe(false);
    expect(nodeTooOld('24.14.0', '22.12.0')).toBe(false);
    expect(nodeTooOld('22.100.0', '22.12.0')).toBe(false);
  });
});
