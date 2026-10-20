import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { initWorkspace, packageVersion } from '../../src/cli/init';
import { loadTree } from '../../src/model/tree';

const dirs: string[] = [];
function tempDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'wayforge-init-'));
  dirs.push(d);
  return join(d, 'talk');
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const schemaOf = (file: string) => (JSON.parse(readFileSync(file, 'utf8')) as { $schema: string }).$schema;

describe('wayforge init', () => {
  it('writes the starter, the orientation files and copies of the guides', () => {
    const dir = tempDir();
    const r = initWorkspace(dir);
    for (const f of [
      'story.json',
      'AGENTS.md',
      'CLAUDE.md',
      '.wayforge/VERSION',
      '.wayforge/docs/authoring.md',
      '.wayforge/docs/llm-authoring.md',
      '.wayforge/schema/journey.schema.json',
      '.wayforge/schema/theme.schema.json',
      '.wayforge/examples/support-ticket.json',
    ]) {
      expect(existsSync(join(dir, f)), f).toBe(true);
    }
    expect(r.kept).toEqual([]);
    expect(readFileSync(join(dir, '.wayforge/VERSION'), 'utf8').trim()).toBe(packageVersion());
  });

  it('gives a starter and examples that validate, with $schema paths that resolve', () => {
    const dir = tempDir();
    initWorkspace(dir);
    for (const file of [join(dir, 'story.json'), join(dir, '.wayforge/examples/support-ticket.json'), join(dir, '.wayforge/examples/knowledge-base.json')]) {
      expect(loadTree(file).issues.filter((i) => i.level === 'error'), file).toEqual([]);
      expect(existsSync(resolve(file, '..', schemaOf(file))), file).toBe(true);
    }
    expect(loadTree(join(dir, 'story.json')).issues).toEqual([]);
  });

  it('refreshes the copies on a second run but keeps the author files', () => {
    const dir = tempDir();
    initWorkspace(dir);
    writeFileSync(join(dir, 'story.json'), '{"edited": true}');
    writeFileSync(join(dir, 'AGENTS.md'), 'mine');
    writeFileSync(join(dir, '.wayforge/docs/authoring.md'), 'stale');
    const r = initWorkspace(dir);
    expect(readFileSync(join(dir, 'story.json'), 'utf8')).toBe('{"edited": true}');
    expect(readFileSync(join(dir, 'AGENTS.md'), 'utf8')).toBe('mine');
    expect(readFileSync(join(dir, '.wayforge/docs/authoring.md'), 'utf8')).not.toBe('stale');
    expect(r.created).toEqual([]);
    expect(r.kept).toHaveLength(3);
  });

  it('names the starter with --name', () => {
    const dir = tempDir();
    initWorkspace(dir, 'onboarding');
    expect(existsSync(join(dir, 'onboarding.json'))).toBe(true);
  });
});
