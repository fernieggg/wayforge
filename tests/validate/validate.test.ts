import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readJson } from '../../src/model/load';
import type { Issue } from '../../src/model/types';
import { validateFile, validateJourney } from '../../src/validate';
import { HAS_REGRESSION_JOURNEY, REGRESSION_JOURNEY } from '../regression/env';

const ROOT = resolve(__dirname, '../..');
const theme = readJson(resolve(ROOT, 'themes/default.json'));
const minimal = () => structuredClone(readJson(resolve(__dirname, 'fixtures/minimal.json'))) as any;
const run = (j: unknown) => validateJourney(j, () => theme).issues;
const errors = (issues: Issue[]) => issues.filter((i) => i.level === 'error');
const warnings = (issues: Issue[]) => issues.filter((i) => i.level === 'warning');

describe('valid journeys', () => {
  it('accepts the minimal fixture with no issues', () => {
    expect(run(minimal())).toEqual([]);
  });

  it('accepts the bundled example journeys', () => {
    for (const f of ['journeys/examples/support-ticket.json']) {
      const file = resolve(ROOT, f);
      if (!existsSync(file)) continue;
      expect(errors(validateFile(file).issues)).toEqual([]);
    }
  });

  it.skipIf(!HAS_REGRESSION_JOURNEY)('accepts the regression journey', () => {
    const { issues, resolved } = validateFile(REGRESSION_JOURNEY!);
    expect(errors(issues)).toEqual([]);
    expect(resolved).toBeDefined();
  });
});

type Case = [name: string, rule: string, path: string, mutate: (j: any) => void];

const ERROR_CASES: Case[] = [
  ['unknown field', 'schema', 'nodes[0](a)', (j) => (j.nodes[0].colour = 'red')],
  ['node without position', 'schema', 'nodes[0](a)', (j) => delete j.nodes[0].at],
  ['bad id', 'schema', 'nodes[0](1a).id', (j) => (j.nodes[0].id = '1a')],
  ['unknown effect type', 'schema', 'scenes.system[0].effects[0]', (j) => (j.scenes.system[0].effects[0].type = 'spin')],
  ['duplicate node id', 'duplicate-id', 'nodes[1](a)', (j) => (j.nodes[1].id = 'a')],
  ['duplicate edge id', 'duplicate-id', 'edges[1](ab)', (j) => (j.edges[1].id = 'ab')],
  ['duplicate row id', 'duplicate-id', 'nodes[2](c).rows[1]', (j) => (j.nodes[2].rows[0] = { id: 'two', text: 'x' })],
  ['two default lenses', 'default-lens', 'lenses', (j) => (j.lenses[0].default = true)],
  ['unknown node in scene', 'unknown-node', 'scenes.user[0].active.nodes[1]', (j) => (j.scenes.user[0].active.nodes[1] = 'zz')],
  ['unknown node via group', 'unknown-node', 'scenes.system[0].active.nodes[0]', (j) => j.groups.all.push('zz')],
  ['unknown edge in scene', 'unknown-edge', 'scenes.user[0].active.edges[0]', (j) => (j.scenes.user[0].active.edges[0] = 'zz')],
  ['unknown edge in route', 'unknown-edge', 'scenes.user[0].routes[0].edges[1]', (j) => (j.scenes.user[0].routes[0].edges[1] = 'zz')],
  ['unknown edge in label', 'unknown-edge', 'labels[0].edge', (j) => (j.labels[0].edge = 'zz')],
  ['route edge not in lens', 'route-edge-not-in-lens', 'scenes.system[0].routes[0].edges[0]', (j) => (j.scenes.system[0].routes[0].edges = ['bc'])],
  ['route edge parked', 'route-edge-not-in-lens', 'scenes.user[0].routes[0].edges[0]', (j) => (j.edges[0].lenses = [])],
  ['unknown group', 'bad-group', 'scenes.system[0].active.nodes[0]', (j) => (j.scenes.system[0].active.nodes = ['@nope'])],
  ['group cycle', 'bad-group', 'groups.all', (j) => j.groups.all.push('@all')],
  ['lens with no scenes', 'lens-without-scenes', 'scenes.user', (j) => (j.scenes.user = [])],
  ['lens missing from scenes', 'lens-without-scenes', 'scenes.user', (j) => delete j.scenes.user],
  ['scenes for unknown lens', 'unknown-lens', 'scenes.other', (j) => (j.scenes.other = j.scenes.user)],
  ['key not in stageOrder', 'key-not-in-stage-order', 'scenes.user[0].key', (j) => (j.scenes.user[0].key = 'later')],
  ['unknown layer', 'unknown-layer', 'nodes[0](a).layer', (j) => (j.nodes[0].layer = 'front')],
  ['unknown scene layer', 'unknown-layer', 'scenes.system[1].layers[0]', (j) => (j.scenes.system[1].layers = ['front'])],
  ['unknown lens on node', 'unknown-lens', 'nodes[1](b).lenses[0]', (j) => (j.nodes[1].lenses = ['admin'])],
  ['unknown lens in offset', 'unknown-lens', 'nodes[0](a).offsetByLens.admin', (j) => (j.nodes[0].offsetByLens = { admin: [1, 1] })],
  ['unknown tone', 'unknown-tone', 'nodes[0](a).tone', (j) => (j.nodes[0].tone = 'chartreuse')],
  ['unknown pill tone', 'unknown-tone', 'nodes[0](a).pills[0].tone', (j) => (j.nodes[0].pills = [{ text: 'X', tone: 'mauve' }])],
  ['rows on a box', 'rows-not-container', 'nodes[0](a).rows', (j) => (j.nodes[0].rows = ['x'])],
  ['metric for wrong kind', 'bad-metric', 'nodes[0](a).metrics.rowsTop', (j) => (j.nodes[0].metrics = { rowsTop: 4 })],
  ['zero size', 'bad-size', 'nodes[0](a).size', (j) => (j.nodes[0].size = [0, 10])],
  ['zero-width camera', 'bad-size', 'scenes.user[0].camera', (j) => (j.scenes.user[0].camera = [0, 0, 0, 10])],
  ['malformed path', 'bad-path', 'edges[0](ab).path', (j) => (j.edges[0].path = 'M0 0 L 5')],
  ['effect on a box', 'effect-not-container', 'scenes.system[0].effects[0].node', (j) => (j.scenes.system[0].effects[0].node = 'a')],
  ['unknown row', 'unknown-row', 'scenes.system[1].effects[0].row', (j) => (j.scenes.system[1].effects[0].row = 'three')],
];

describe('errors', () => {
  it.each(ERROR_CASES)('%s', (_name, rule, path, mutate) => {
    const j = minimal();
    mutate(j);
    const errs = errors(run(j));
    expect(errs.length).toBeGreaterThan(0);
    expect(errs.map((e) => `${e.rule} @ ${e.path}`)).toContain(`${rule} @ ${path}`);
  });

  it('reports bad theme overrides against the theme schema', () => {
    const j = minimal();
    j.themeOverrides = { packet: { speed: 'fast' } };
    expect(errors(run(j))[0]).toMatchObject({ rule: 'theme-schema', path: 'theme (with themeOverrides).packet.speed' });
  });

  it('applies theme overrides before checking tones', () => {
    const j = minimal();
    j.themeOverrides = { tones: { mauve: { color: 'deep' } } };
    j.nodes[0].tone = 'mauve';
    expect(errors(run(j))).toEqual([]);
  });
});

const WARNING_CASES: Case[] = [
  ['wide camera on a content scene', 'readability', 'scenes.user[0].camera', (j) => (j.scenes.user[0].camera = [0, 0, 4000, 1000])],
  ['active but invisible', 'active-not-visible', 'scenes.system[0].active.edges', (j) => (j.scenes.system[0].active.edges = ['bc'])],
  ['route gap outside nodes', 'route-gap', 'scenes.user[0].routes[0].edges[1]', (j) => (j.edges[1].path = 'M390 200 L500 40')],
  ['row overflow', 'row-overflow', 'nodes[2](c).rows', (j) => (j.nodes[2].size = [240, 100])],
  ['cycle rows without a soft tone', 'tone-without-soft', 'scenes.system[0].effects[0]', (j) => (j.nodes[2].tone = 'pink')],
  ['label on hidden edge', 'label-on-hidden-edge', 'labels[0]', (j) => (j.edges[0].hidden = true)],
];

describe('warnings', () => {
  it.each(WARNING_CASES)('%s', (_name, rule, path, mutate) => {
    const j = minimal();
    mutate(j);
    const issues = run(j);
    expect(errors(issues)).toEqual([]);
    expect(warnings(issues).map((e) => `${e.rule} @ ${e.path}`)).toContain(`${rule} @ ${path}`);
  });

  it('exempts wide scenes from the readability lint', () => {
    const j = minimal();
    j.scenes.user[0].camera = [0, 0, 4000, 1000];
    j.scenes.user[0].wide = true;
    expect(run(j)).toEqual([]);
  });

  it('accepts a jump that happens beneath one node, with lens offsets applied', () => {
    const j = minimal();
    j.nodes[1].offsetByLens = { user: [0, 100] };
    j.edges[1].path = 'M380 140 L500 40';
    j.edges[0].path = 'M200 40 L300 140';
    expect(warnings(run(j))).toEqual([]);
  });
});
