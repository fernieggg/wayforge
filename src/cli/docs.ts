import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PACKAGE_ROOT } from '../model/load';

const DOCS: Record<string, string> = {
  authoring: 'docs/authoring.md',
  llm: 'docs/llm-authoring.md',
  schema: 'schema/journey.schema.json',
};

export function runDocs(args: string[]): number {
  const name = args[0];
  if (!name) {
    process.stderr.write('Wayforge guides in this install:\n');
    for (const [key, path] of Object.entries(DOCS)) process.stderr.write(`  ${key.padEnd(10)} ${resolve(PACKAGE_ROOT, path)}\n`);
    process.stderr.write('\nPrint one with: wayforge docs <name>   (for example: wayforge docs llm)\n');
    process.stderr.write('`wayforge init` copies them into a folder, next to your journeys.\n');
    return 0;
  }
  const path = DOCS[name];
  if (!path) {
    process.stderr.write(`error: unknown guide "${name}" (choose ${Object.keys(DOCS).join(', ')})\n`);
    return 2;
  }
  process.stdout.write(readFileSync(resolve(PACKAGE_ROOT, path), 'utf8'));
  return 0;
}
