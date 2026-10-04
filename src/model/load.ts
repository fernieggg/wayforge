import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export class LoadError extends Error {}

export function readJson(file: string): unknown {
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch (err) {
    throw new LoadError(`cannot read ${file}: ${(err as Error).message}`);
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new LoadError(`${file} is not valid JSON: ${(err as Error).message}`);
  }
}

/** A bare name is a built-in theme in themes/; anything else is a path relative to the journey file. */
export function themePath(theme: string | undefined, journeyFile: string): string {
  const name = theme ?? 'default';
  if (/^[A-Za-z0-9_-]+$/.test(name)) return resolve(PACKAGE_ROOT, 'themes', `${name}.json`);
  return resolve(dirname(journeyFile), name);
}
