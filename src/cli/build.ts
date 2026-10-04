import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { buildHtml } from '../render/html';
import { runtimeBundle } from '../render/runtimeBundle';
import { loadTree } from '../model/tree';
import { report } from './validate';

export const MAX_BYTES = 16 * 1024 * 1024;

export function defaultOut(file: string): string {
  return resolve('dist', basename(file, extname(file)) + '.html');
}

/** Validates the journey and its sub-flows and builds them into one page; null when validation fails. */
export async function buildFile(file: string, strict = false): Promise<string | null> {
  const result = loadTree(file);
  if (!report(file, result, strict) || !result.flows) return null;
  return buildHtml(result.flows, await runtimeBundle());
}

export async function runBuild(args: string[]): Promise<number> {
  const { positionals, values } = parseArgs({
    args,
    allowPositionals: true,
    options: { out: { type: 'string', short: 'o' }, strict: { type: 'boolean' } },
  });
  const file = positionals[0];
  if (!file) {
    process.stderr.write('usage: wayforge build <journey.json> [-o out.html] [--strict]\n');
    return 2;
  }
  const html = await buildFile(file, values.strict ?? false);
  if (html === null) return 1;
  const bytes = Buffer.byteLength(html);
  if (bytes > MAX_BYTES) {
    process.stderr.write(`error: built page is ${bytes} bytes, over the 16 MB limit\n`);
    return 1;
  }
  const out = values.out ? resolve(values.out) : defaultOut(file);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  process.stderr.write(`wrote ${out} (${(bytes / 1024).toFixed(1)} KB)\n`);
  return 0;
}
