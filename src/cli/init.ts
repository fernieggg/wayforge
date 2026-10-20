import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { PACKAGE_ROOT } from '../model/load';

/** The folder inside a workspace that holds copies of the installed guides, schema and examples. */
export const WORKSPACE_DIR = '.wayforge';

export function packageVersion(): string {
  return (JSON.parse(readFileSync(resolve(PACKAGE_ROOT, 'package.json'), 'utf8')) as { version: string }).version;
}

function jsonFiles(dir: string, ext: string): string[] {
  return readdirSync(dir).filter((f) => f.endsWith(ext)).sort();
}

/** Writes `text` to `file` unless it exists; the author's files are never overwritten. */
function writeOnce(file: string, text: string, created: string[], kept: string[]): void {
  if (existsSync(file)) kept.push(file);
  else {
    writeFileSync(file, text);
    created.push(file);
  }
}

export interface InitResult {
  dir: string;
  journey: string;
  created: string[];
  kept: string[];
}

/**
 * Sets up a folder for writing journeys. The `.wayforge/` copies are replaced on every run,
 * which is how a workspace picks up the guides of a newer install; the journey and the
 * LLM orientation files belong to the author once written.
 */
export function initWorkspace(dir: string, journeyName = 'story.json'): InitResult {
  const root = resolve(dir);
  const ws = join(root, WORKSPACE_DIR);
  mkdirSync(root, { recursive: true });
  rmSync(ws, { recursive: true, force: true });

  for (const [from, to, ext] of [
    ['docs', 'docs', '.md'],
    ['schema', 'schema', '.json'],
  ] as const) {
    mkdirSync(join(ws, to), { recursive: true });
    for (const f of jsonFiles(resolve(PACKAGE_ROOT, from), ext)) copyFileSync(resolve(PACKAGE_ROOT, from, f), join(ws, to, f));
  }
  // Examples keep their sub-flow references; only the editor hint points at the copied schema.
  mkdirSync(join(ws, 'examples'), { recursive: true });
  const examples = resolve(PACKAGE_ROOT, 'journeys/examples');
  for (const f of jsonFiles(examples, '.json')) {
    const text = readFileSync(join(examples, f), 'utf8').replace(/"\$schema":\s*"[^"]*"/, '"$schema": "../schema/journey.schema.json"');
    writeFileSync(join(ws, 'examples', f), text);
  }
  writeFileSync(join(ws, 'VERSION'), packageVersion() + '\n');

  const templates = resolve(PACKAGE_ROOT, 'templates/workspace');
  const created: string[] = [];
  const kept: string[] = [];
  const journey = join(root, journeyName.endsWith('.json') ? journeyName : `${journeyName}.json`);
  writeOnce(journey, readFileSync(join(templates, 'story.json'), 'utf8'), created, kept);
  writeOnce(join(root, 'AGENTS.md'), readFileSync(join(templates, 'AGENTS.md'), 'utf8'), created, kept);
  writeOnce(join(root, 'CLAUDE.md'), readFileSync(join(templates, 'CLAUDE.md'), 'utf8'), created, kept);
  return { dir: root, journey, created, kept };
}

export function runInit(args: string[]): number {
  const { positionals, values } = parseArgs({ args, allowPositionals: true, options: { name: { type: 'string' } } });
  const dir = positionals[0] ?? '.';
  const r = initWorkspace(dir, values.name);
  const rel = (p: string) => relative(process.cwd(), p) || '.';
  process.stderr.write(`Wayforge ${packageVersion()} workspace in ${rel(r.dir)}\n`);
  process.stderr.write(`  ${rel(join(r.dir, WORKSPACE_DIR))}  guides, schema and examples (refreshed)\n`);
  for (const f of r.created) process.stderr.write(`  ${rel(f)}  created\n`);
  for (const f of r.kept) process.stderr.write(`  ${rel(f)}  kept (already there)\n`);
  const cd = rel(r.dir) === '.' ? '' : `  cd ${rel(r.dir)}\n`;
  process.stderr.write(`\nNext:\n${cd}  wayforge dev ${basename(r.journey)}\n\nThe guide is ${WORKSPACE_DIR}/docs/authoring.md. AI tools find their brief through AGENTS.md.\n`);
  return 0;
}
